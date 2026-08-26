import assert from 'assert';

const BASE_URL = 'http://localhost:4000/api/v1';

async function req(endpoint, options = {}) {
  const url = `${BASE_URL}${endpoint}`;
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  const res = await fetch(url, { ...options, headers });
  const data = await res.json();
  return { status: res.status, ok: res.ok, data };
}

async function runTests() {
  console.log('--- Starting RestroVico API & UAT Test Suite ---');
  let testCount = 0;
  let passCount = 0;

  function test(name, pass) {
    testCount++;
    if (pass) {
      passCount++;
      console.log(`✅ PASS: ${name}`);
    } else {
      console.error(`❌ FAIL: ${name}`);
    }
  }

  // 1. Health check
  const health = await req('/health');
  test('Health check endpoint returns status UP', health.status === 200 && health.data.data.status === 'UP');

  // 2. AUTH-01: Valid Owner Signup
  const email = `owner_${Date.now()}@example.com`;
  const mobile = `+9198${Math.floor(10000000 + Math.random() * 90000000)}`;
  const password = 'Password123';

  const signup = await req('/auth/signup', {
    method: 'POST',
    body: JSON.stringify({
      fullName: 'Aditi Mehra',
      email,
      mobile,
      password,
      confirmPassword: password,
      termsAccepted: true
    })
  });
  test('AUTH-01: Valid owner signup creates account & pending verification', signup.status === 201 && signup.data.data.status === 'PENDING_VERIFICATION');

  const verificationToken = signup.data.data.devVerificationToken;
  assert(verificationToken, 'Verification token must be returned in dev mode');

  // 3. AUTH-02: Duplicate Email Signup Blocked
  const dupEmail = await req('/auth/signup', {
    method: 'POST',
    body: JSON.stringify({
      fullName: 'Aditi Clone',
      email,
      mobile: '+919811111111',
      password,
      confirmPassword: password,
      termsAccepted: true
    })
  });
  test('AUTH-02: Duplicate email signup blocked with 422', dupEmail.status === 422 && dupEmail.data.message.includes('email address already exists'));

  // 4. AUTH-03: Duplicate Mobile Signup Blocked
  const dupMobile = await req('/auth/signup', {
    method: 'POST',
    body: JSON.stringify({
      fullName: 'Aditi Clone 2',
      email: `other_${Date.now()}@example.com`,
      mobile,
      password,
      confirmPassword: password,
      termsAccepted: true
    })
  });
  test('AUTH-03: Duplicate mobile signup blocked with 422', dupMobile.status === 422 && dupMobile.data.message.includes('mobile number already exists'));

  // 5. Login before verification should be blocked
  const preVerifyLogin = await req('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ identifier: email, password })
  });
  test('AUTH-06 (Pre-check): Login blocked before email verification', preVerifyLogin.status === 403 && preVerifyLogin.data.message.includes('verify your email'));

  // 6. AUTH-06: Email Verification
  const verifyRes = await req('/auth/verify-email', {
    method: 'POST',
    body: JSON.stringify({ token: verificationToken })
  });
  test('AUTH-06: Email verification activates owner account', verifyRes.status === 200 && verifyRes.data.data.status === 'ACTIVE');

  // 7. AUTH-10: Login with wrong password
  const wrongPassLogin = await req('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ identifier: email, password: 'WrongPassword99' })
  });
  test('AUTH-10: Login with wrong password returns 401 generic error', wrongPassLogin.status === 401 && wrongPassLogin.data.message.includes('Invalid'));

  // 8. AUTH-08: Successful Login
  const loginRes = await req('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ identifier: email, password })
  });
  if (loginRes.status !== 200) {
    console.error('Login failure debug:', loginRes);
  }
  test('AUTH-08: Login returns access & refresh tokens', loginRes.status === 200 && loginRes.data.data && loginRes.data.data.accessToken && loginRes.data.data.user.role === 'OWNER');

  const token = loginRes.data.data.accessToken;
  const authHeaders = { Authorization: `Bearer ${token}` };

  // 9. Profile & Settings
  const profileRes = await req('/me', { headers: authHeaders });
  test('GET /me returns owner profile details', profileRes.status === 200 && profileRes.data.data.email === email);

  // 10. REST-01: Create First Restaurant
  const rest1 = await req('/restaurants', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      name: 'The Pepper House',
      businessType: 'Restaurant',
      mobile: '+91 98765 43210',
      addressLine: 'NX One, Sector 14',
      city: 'Noida',
      state: 'Uttar Pradesh',
      pincode: '201301'
    })
  });
  test('REST-01: Create restaurant auto-generates valid code format', rest1.status === 201 && /^RV-R\d{4}$/.test(rest1.data.data.restaurant_code));
  const rest1Id = rest1.data.data.id;

  // 11. REST-03: Create Second Restaurant
  const rest2 = await req('/restaurants', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      name: 'Pepper Express',
      businessType: 'Cloud Kitchen',
      mobile: '+91 98765 43211',
      addressLine: 'DLF Phase 3',
      city: 'Gurugram',
      state: 'Haryana',
      pincode: '122002'
    })
  });
  test('REST-03: Create second restaurant auto-generates valid code format', rest2.status === 201 && /^RV-R\d{4}$/.test(rest2.data.data.restaurant_code));

  // 12. List Restaurants
  const listRes = await req('/restaurants', { headers: authHeaders });
  test('GET /restaurants returns tenant restaurants & KPI summary', listRes.status === 200 && listRes.data.data.restaurants.length === 2 && listRes.data.data.summary.total === 2);

  // 13. REST-04: Edit Restaurant
  const editRes = await req(`/restaurants/${rest1Id}`, {
    method: 'PATCH',
    headers: authHeaders,
    body: JSON.stringify({
      name: 'The Pepper House Prime',
      city: 'Greater Noida'
    })
  });
  test('REST-04: Edit restaurant updates record', editRes.status === 200 && editRes.data.data.name === 'The Pepper House Prime');

  // 14. REST-05: Update Restaurant Status
  const statusRes = await req(`/restaurants/${rest1Id}/status`, {
    method: 'PATCH',
    headers: authHeaders,
    body: JSON.stringify({ status: 'INACTIVE' })
  });
  test('REST-05: Status update sets status to INACTIVE', statusRes.status === 200 && statusRes.data.data.status === 'INACTIVE');

  // 15. SEC-01: Tenant Isolation Verification
  const email2 = `owner2_${Date.now()}@example.com`;
  const signup2 = await req('/auth/signup', {
    method: 'POST',
    body: JSON.stringify({
      fullName: 'Owner Two',
      email: email2,
      mobile: `+9197${Math.floor(10000000 + Math.random() * 90000000)}`,
      password,
      confirmPassword: password,
      termsAccepted: true
    })
  });
  await req('/auth/verify-email', { method: 'POST', body: JSON.stringify({ token: signup2.data.data.devVerificationToken }) });
  const login2 = await req('/auth/login', { method: 'POST', body: JSON.stringify({ identifier: email2, password }) });
  const token2 = login2.data.data.accessToken;

  const crossTenantGet = await req(`/restaurants/${rest1Id}`, { headers: { Authorization: `Bearer ${token2}` } });
  test('SEC-01: Cross-tenant restaurant access returns 404/403', crossTenantGet.status === 404);

  // 16. PWD-01 & PWD-02: Forgot Password
  const forgotRes = await req('/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify({ email })
  });
  test('PWD-01/02: Forgot password returns neutral success message', forgotRes.status === 200 && forgotRes.data.message.includes('If an account exists'));

  console.log(`\n--- Test Summary: ${passCount}/${testCount} passed ---`);
  if (passCount === testCount) {
    console.log('🎉 ALL BACKEND API & UAT TEST CASES PASSED!');
  } else {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Test suite error:', err);
  process.exit(1);
});
