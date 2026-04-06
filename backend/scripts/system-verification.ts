import { runSystemVerification } from '../test/helpers/system-verification.ts';

function summarizeVerificationBootstrapFailure(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  const databaseUrl = process.env.DATABASE_URL?.trim() || null;

  if (
    message.includes('Error validating datasource `db`') ||
    message.includes('the URL must start with the protocol `prisma://`') ||
    message.includes('the URL must start with the protocol `prisma+postgres://`')
  ) {
    console.log('ROBOSS system verification');
    console.log('Result: FAIL');
    console.log('Go/No-Go: NO-GO');
    console.log('\nBootstrap blocker:');
    console.log(
      `- Prisma datasource is not configured with a valid Accelerate/Postgres URL. Current DATABASE_URL=${databaseUrl ?? '<missing>'}`
    );
    console.log('\nWhat to fix before rerun:');
    console.log('- Set DATABASE_URL to a valid Prisma Accelerate or Postgres connection string');
    console.log('- If local verification needs a direct local database, load the correct backend .env before running');
    console.log('- Re-run: `npx tsx scripts/system-verification.ts`');
    process.exitCode = 1;
    return true;
  }

  if (
    message.includes("Can't reach database server at") ||
    message.includes('Connection refused') ||
    message.includes('ECONNREFUSED')
  ) {
    console.log('ROBOSS system verification');
    console.log('Result: FAIL');
    console.log('Go/No-Go: NO-GO');
    console.log('\nBootstrap blocker:');
    console.log(`- Database is not reachable for system verification. Current DATABASE_URL=${databaseUrl ?? '<missing>'}`);
    console.log('\nWhat to fix before rerun:');
    console.log('- Start the local/staging Postgres instance referenced by DATABASE_URL')
    console.log('- Apply schema if needed: `npm run db:migrate` or the correct shared-environment migrate flow')
    console.log('- Seed demo data if this environment is meant for verification: `npm run db:seed`')
    console.log('- Re-run with local engine regeneration: `npm run verify:system:local`')
    process.exitCode = 1;
    return true;
  }

  return false;
}

async function main() {
  const result = await runSystemVerification();

  console.log('ROBOSS system verification');
  console.log(`Result: ${result.ok ? 'PASS' : 'FAIL'}`);
  console.log(`Go/No-Go: ${result.goNoGo.toUpperCase()}`);

  console.log('\nCriteria:');
  result.criteria.forEach((criterion) => {
    console.log(`- [${criterion.passed ? 'x' : ' '}] ${criterion.name}`);
  });

  console.log('\nSteps:');
  result.steps.forEach((step) => {
    console.log(`- ${step.passed ? 'PASS' : 'FAIL'} ${step.name}: ${step.detail}`);
  });

  console.log('\nArtifacts:');
  console.log(JSON.stringify(result.artifacts, null, 2));

  if (result.blockers.length > 0) {
    console.log('\nProduction blockers:');
    result.blockers.forEach((blocker) => {
      console.log(`- ${blocker}`);
    });
  }

  if (!result.ok) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  if (summarizeVerificationBootstrapFailure(error)) {
    return;
  }

  console.error(error instanceof Error ? error.stack || error.message : error);
  process.exit(1);
});
