# Deployment API powered by Docker Compose

This is a simple project to help with CI/CD on dedicated servers, without using huge PaaS projects or kubernetes.

This assumes that the user running the Deno project is either root **(not recommended)** or has access to a rootless docker environment.

Your environment should support `docker compose` (not `docker-compose`).

## Note

This server may or may not be used in a production environment, depending on your needs.
However, I highly discourage the use of such a script in an enterprise environment, since it shares the same deploy key for all projects.

These choices are intentional as they are intended for use on a personal server, with few pipelines reaching this endpoint.

## Structure

Since this project is simple, it is in a simple `main.ts` file, without `deps.ts`.

It uses `Oak` and `dotenv` autoloader.

## API

Only a single endpoint is available through `http://localhost:PORT/`.

It should accept multiple formats, but has only been tested with `application/json` bodies.

```json5
{
  // The name of the deployed application, will create a folder named myApp
  "name": "myApp",
  
  // The url to git clone
  "url": "https://github.com/Feelzor/myAwesomeDockerComposeProject.git",
  
  // Which version to checkout (may be a branch, or a tag)
  "tag": "v0.0.1",
  
  // The secret to avoid having anyone deploy on your server
  // Always use long and unguessable secrets for production environments
  "secret": "ABCDEF",
  
  // The list of environment variables to put in a .env file
  "env": {
    "MY_ENV": "value"
  }
}
```

## Start the server

Deno allows us to limit the rights of the application. This command tries to minimize some of them, while allowing a large access to read/write.

```bash
deno run --allow-read='.env','.env.defaults','/my/deployment/path/' --allow-write='/my/deployment/path/' --allow-env='PORT','SECRET_ACCESS_KEY','DEPLOYMENT_ROOT_FOLDER' --allow-net='localhost' --allow-run='git','docker' src/main.ts
```
