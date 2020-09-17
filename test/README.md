# Testing of AWS IAM Signatures

Here's a quick description of how to test this plugin manually.

## Setup

1. Make sure that [Node and NPM](https://nodejs.org/en/download/) are installed. Latest versions should work well.

2. The test API is described in the `serverless.yml` so, the Serverless.com tool will need to be installed:

```bash
npm install -g serverless
```

3. Install the dependencies in the `test` directory, run:

```bash
npm install
```

This makes `artllery` available at `./node_modules/.bin/artillery` 
and will install the [published version of `artillery-plugin-aws-sigv4`
from NPM](https://www.npmjs.com/package/artillery-plugin-aws-sigv4).

4. Deploy the service to target with the tests.

Ensure that [AWS is configured to deploy the service](https://www.serverless.com/framework/docs/providers/aws/cli-reference/config-credentials/) and run:
```bash
sls deploy
```

A successful result will look like:
```bash
bash-3.2$ sls deploy
Serverless: Packaging service...
Serverless: Excluding development dependencies...
Serverless: Uploading CloudFormation file to S3...
Serverless: Uploading artifacts...
Serverless: Uploading service test.zip file to S3 (903 B)...
Serverless: Validating template...
Serverless: Updating Stack...
Serverless: Checking Stack update progress...
................
Serverless: Stack update finished...
Service Information
service: test
stage: dev
region: us-east-1
stack: test-dev
resources: 11
api keys:
  None
endpoints:
  GET - https://fev6jm4al9.execute-api.us-east-1.amazonaws.com/dev/testing
functions:
  hello: test-dev-hello
layers:
  None
```

Copy the endpoint `GET` address and update the `script.yml` with that new address, for example:

```yaml
config:
  # this hostname will be used as a prefix for each URI in the flow unless a complete URI is specified
  target: "https://fev6jm4al9.execute-api.us-east-1.amazonaws.com"
```

5. Make sure the `AWS_REGION` is set correctly for the deployed endpoint, for example:

```bash
export AWS_REGION=us-east-1
```

6. Vaildate the environment by running the Artillery test against the endpoint:
```
./node_modules/.bin/artillery run script.yml
```

If correct, the result should look like:
```
All virtual users finished
Summary report @ 14:55:09(-0500) 2020-09-09
  Scenarios launched:  10
  Scenarios completed: 10
  Requests completed:  10
  Mean response/sec: 2.01
  Response time (msec):
    min: 96.2
    max: 948.2
    median: 152.2
    p95: 948.2
    p99: 948.2
  Scenario counts:
    0: 10 (100%)
  Codes:
    200: 10
```

## Testing Local Plugin Code

1. Remove the published aws-sigv4 plugin using:

```
npm uninstall artillery-plugin-aws-sigv4
```

To check that the plugin is no longer available, run the artillery command again:
```
./node_modules/.bin/artillery run script.yml 
```

 and there should be an error:
```
.   WARNING: Plugin aws-sigv4 specified but module artillery-plugin-aws-sigv4 could not be found (MODULE_NOT_FOUND)
```

2. Install the version of the plugin from the local repo using:

```
npm install ..
```

Note: This creates a link from the node_modules/artillery-plugin-aws-sigv4 directory to the project dir:

```
lrwxr-xr-x    1 a09y  185223974      5 Sep  9 16:13 artillery-plugin-aws-sigv4 -> ../..
```

To invalidate and remove this link, use:

```
npm unlink artillery-plugin-aws-sigv4
```

otherwise any install of `artillery-plugin-aws-sigv4` will simply link to the project directory.

3. Run the artillery test to validate the result:

```
./node_modules/.bin/artillery run ./script.yml
```

## Troubleshooting

* `WARNING: Plugin aws-sigv4 specified but module artillery-plugin-aws-sigv4 could not be found (MODULE_NOT_FOUND)`

Make sure that the `artillery` command used is running from the `test` directory and not the global install: `./node_modules/.bin/artillery`

Make sure that the dependencies are installed in the `test` directory with `npm install`.

* `artillery-plugin-aws-sigv4 ERROR (signature will not be added): valid region not configured.  Ensure the aws-sdk can obtain a valid region for use in signing your requests.  Consider exporting or setting AWS_REGION.  Alternatively specify a default region in your ~/.aws/config file.`

Ensure that the AWS configuration defines a default region (that matches the deployed target service) or set the region using:

```bash
export AWS_REGION=us-east-1
```
