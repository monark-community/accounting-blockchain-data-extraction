import swaggerJsdoc from "swagger-jsdoc";

export const swaggerSpec = swaggerJsdoc({
  definition: {
    openapi: "3.0.3",
    info: {
      title: "LedgerLift API",
      version: "0.1.0",
      description:
        "On-chain analytics, transactions, wallet aggregation, and reporting endpoints for LedgerLift.",
    },
    servers: [
      {
        url: "/api",
        description: "Local / container",
      },
    ],
  },
  // JSDoc blocks in routes and services
  apis: ["./src/routes/**/*.ts"],
});
