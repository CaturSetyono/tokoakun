
async function testRegister() {
  const payload = {
    name: "Test User",
    email: "test_" + Date.now() + "@example.com",
    password: "password123",
    role: "buyer"
  };

  console.log("Testing registration with:", payload);

  try {
    const response = await fetch("http://localhost:4321/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const result = await response.json();
    console.log("Status:", response.status);
    console.log("Result:", result);
  } catch (err) {
    console.error("Fetch error:", err);
  }
}

testRegister();
