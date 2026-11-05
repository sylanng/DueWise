   import express from "express";
   import cors from "cors";
   import "dotenv/config";

   const app = express();
   app.use(cors({ origin: ["http://localhost:5173"] }));
   app.use(express.json());

   app.get("/api/health", (req, res) => {
     res.json({ status: "OK", time: new Date().toISOString() });
   });

   const PORT = process.env.PORT || 4000;
   app.listen(PORT, () => console.log(`API running on port ${PORT}`));