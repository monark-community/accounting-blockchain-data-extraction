import swaggerJsdoc from "swagger-jsdoc";
import path from "path";

const routesGlob = path.resolve(__dirname, "../routes/**/*.{ts,js}");

export const swaggerSpec = swaggerJsdoc({
  definition: {
    openapi: "3.0.3",
    info: {
      title: "LedgerLift API",
      version: "0.1.0",
      description:
        "On-chain analytics, transactions, wallet aggregation, and reporting endpoints for LedgerLift.",
    },
    components: {
      securitySchemes: {
        cookieAuth: {
          type: "apiKey",
          in: "cookie",
          name: process.env.SESSION_NAME || "ll_session",
        },
      },
    },
    servers: [
      {
        url: "/api",
        description: "Local / container",
      },
    ],
  },
  // JSDoc blocks in routes and services
  // Use compiled JS in prod (Render) and TS in dev via a single glob
  apis: [routesGlob],
});
