const guestId = "test-runner-" + Date.now();
const guestSecret = "12345678901234567890123456789012345";

async function req(path, body = {}) {
  const headers = {
    'x-guest-id': guestId,
    'x-guest-secret': guestSecret,
    'content-type': 'application/json'
  };
  const res = await fetch(`https://web-lucky-reels-casino.vercel.app/~api${path}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body)
  });
  
  const data = await res.json();
  if (data.error) throw new Error(`${path} failed: ${data.error} - ${data.message}`);
  return data;
}

async function runTests() {
  console.log("1. Creating session...");
  const session = await req('/session');
  console.log("   Balance:", session.player.balance);
  
  console.log("2. Claiming Daily Wheel...");
  const wheel = await req('/wheel');
  console.log("   Wheel response:", wheel);
  
  console.log("3. Claiming Daily Streak...");
  const streak = await req('/streak');
  console.log("   Streak response:", streak);
  
  console.log("4. Spinning Egyptian Treasure...");
  let spins = 0;
  for (let i = 0; i < 5; i++) {
    const spin = await req('/spin', { machineId: 'egyptian-treasure', betIndex: 0 });
    spins++;
    if (spin.lineWin > 0) {
      console.log(`   Spin ${spins}: WON ${spin.lineWin}!`);
    } else {
      console.log(`   Spin ${spins}: No win`);
    }
  }
  
  console.log("5. Checking Missions...");
  try {
    const missions = await req('/missions', { index: 0 });
    console.log("   Mission claimed:", missions);
  } catch (e) {
    console.log("   Mission not ready yet (expected)");
  }
  
  console.log("6. Final Session sync...");
  const finalSession = await req('/session');
  console.log("   Final Balance:", finalSession.player.balance);
  console.log("✅ All API tests passed!");
}

runTests().catch(console.error);
