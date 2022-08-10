import 'https://deno.land/x/dotenv@v3.2.0/load.ts';
import { Application, Router } from 'https://deno.land/x/oak@v10.6.0/mod.ts';
import { ensureDir } from 'https://deno.land/std@0.151.0/fs/mod.ts';

const port = Number(Deno.env.get('PORT') || '8080');

type Deployment = {
  name: string;
  url: string;
  tag: string;
  secret: string;
  env?: Record<string, string>;
};

/**
 * Ensure that the body is an expected deployment instruction
 */
function isBodyDeploymentInstruction(body: any): body is Deployment {
  function checkParameterIsString(paramName: string) {
    return body[paramName] != null && typeof body[paramName] === 'string';
  }

  // Our json should be an object, not an array
  if (Array.isArray(body)) return false;

  if (!checkParameterIsString('name')) return false;
  if (!checkParameterIsString('url')) return false;
  if (!checkParameterIsString('tag')) return false;
  if (!checkParameterIsString('secret')) return false;

  if (body.env == null) return true; // Optional argument
  else if (Array.isArray(body.env)) return false;

  let hasEnvProperValues = true;
  Object.keys(body.env).forEach((key) => {
    // Check the Record<string, string> type
    if (typeof body.env[key] !== 'string') hasEnvProperValues = false;
  });

  return hasEnvProperValues;
}

function retrieveEnvFile(env: Record<string, string>): string {
  let envFile = '';

  Object.keys(env).forEach((key) => {
    envFile += `${key}=${env[key]}\n`;
  });

  return envFile;
}

const router = new Router();

let reqNb = 0;
router.post('/', async (ctx) => {
  const currReq = ++reqNb;
  const logPrefix = () => `[${new Date().toISOString()}] ${currReq}:`;
  console.info(`${logPrefix()} POST RECEIVED`);

  if (!ctx.request.hasBody) return ctx.response.status = 400;
  const deploymentObj: unknown = await ctx.request.body().value;

  // Check that request is properly formed
  if (!isBodyDeploymentInstruction(deploymentObj)) return ctx.response.status = 400;

  console.info(`${logPrefix()} SECRET: ${deploymentObj.secret}`);
  console.info(`${logPrefix()} NAME: ${deploymentObj.name}`);
  console.info(`${logPrefix()} URL: ${deploymentObj.url}`);
  if (deploymentObj.env) console.info(`${logPrefix()} ENV: ${JSON.stringify(deploymentObj.env)}`);

  console.log(Deno.env.get('SECRET_ACCESS_KEY'));
  if (deploymentObj.secret !== Deno.env.get('SECRET_ACCESS_KEY')) return ctx.response.status = 403;

  const deploymentDir = `${Deno.env.get('DEPLOYMENT_ROOT_FOLDER')}/${deploymentObj.name}`;
  await ensureDir(deploymentDir);

  console.info(`${logPrefix()} CREATED FOLDER`);

  // Git clone
  await (await Deno.run({
    cmd: ['git', 'clone', deploymentObj.url, deploymentDir],
  })).status();

  // Git fetch
  await (await Deno.run({
    cmd: ['git', 'pull'],
    cwd: deploymentDir,
  })).status();

  // Git checkout
  await (await Deno.run({
    cmd: ['git', 'checkout', deploymentObj.tag],
    cwd: deploymentDir,
  })).status();

  console.info(`${logPrefix()} GIT REPO READY`);

  // Create .env file
  if (deploymentObj.env) {
    console.info(`${logPrefix()} CREATING .env FILE`);
    await Deno.writeTextFile(`${deploymentDir}/.env`, retrieveEnvFile(deploymentObj.env));
  }

  await (await Deno.run({
    cmd: ['docker', 'compose', 'up', '-d'],
    cwd: deploymentDir,
  })).status();

  console.info(`${logPrefix()} DOCKER STARTED`);

  ctx.response.status = 204;
});

const app = new Application();
app.use(router.routes());
app.use(router.allowedMethods());

console.log(`HTTP webserver running. Access it at: http://localhost:${port}/`);
app.listen({ hostname: 'localhost', port });
