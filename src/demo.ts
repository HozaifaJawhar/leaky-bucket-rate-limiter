import { LeakyBucketLimiter } from "./security/LeakyBucketLimiter.ts";

const lb = new LeakyBucketLimiter({
  capacity: 6,
  leakRatePerSec: 2,
  onProcess: (r) => console.log(`   ↳ processed request #${r} (steady drain)`),
});

let id = 0;
function fire(n: number, label: string) {
  console.log(`\n>>> BURST: ${n} requests arrive at once (${label})`);
  for (let i = 0; i < n; i++) {
    const r = lb.tryAdmit(++id);
    const icon = r.admitted ? "✅ 200" : "⛔ 429";
    console.log(`   ${icon}  req #${id}  — ${r.reason}`);
  }
}

console.log("Leaky Bucket: capacity=6, leak=2/sec\n" + "=".repeat(50));

fire(8, "exceeds capacity → 2 should 429");
setTimeout(() => fire(3, "after 1.5s of draining"), 1500);
setTimeout(() => {
  lb.leak();
  console.log("\nFINAL STATE:", lb.getState());
  process.exit(0);
}, 4000);
