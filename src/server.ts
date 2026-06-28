import { createServer } from "node:http";
import { LeakyBucketLimiter } from "./security/LeakyBucketLimiter.ts";

const PORT = Number(process.env.PORT ?? 3000);

const lb = new LeakyBucketLimiter({
  capacity: 6,
  leakRatePerSec: 2,
  onProcess: () => {},
});

const server = createServer((req, res) => {
  const decision = lb.tryAdmit({ url: req.url, at: Date.now() });

  if (decision.admitted) {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ ok: true, ...decision, ...lb.getState() }));
  } else {
    res.writeHead(429, {
      "content-type": "application/json",
      "retry-after": "1",
    });
    res.end(
      JSON.stringify({
        ok: false,
        error: "Rate Limit Exceeded",
        ...decision,
        ...lb.getState(),
      })
    );
  }
});

server.listen(PORT, () => {
  console.log(`Leaky bucket gateway on http://localhost:${PORT} (capacity=6, leak=2/sec)`);
});
