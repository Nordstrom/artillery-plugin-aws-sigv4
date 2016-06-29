'use strict';

var aws = require('aws-sdk'),
    url = require('url'),
    constants = {
        PLUGIN_NAME: 'aws-sigv4',
        PLUGIN_PARAM_SERVICE_NAME: 'serviceName',
        THE: 'The "',
        CONFIG_REQUIRED: '" plugin requires configuration under [script].config.plugins.',
        PARAM_REQUIRED: '" parameter is required',
        PARAM_MUST_BE_STRING: '" param must have a string value',
        HEADER_AUTHORIZATION: 'Authorization'
    },
    messages = {
        pluginConfigRequired: constants.THE + constants.PLUGIN_NAME + constants.CONFIG_REQUIRED + constants.PLUGIN_NAME,
        pluginParamServiceNameRequired: constants.THE + constants.PLUGIN_PARAM_SERVICE_NAME + constants.PARAM_REQUIRED,
        pluginParamServiceNameMustBeString: constants.THE + constants.PLUGIN_PARAM_SERVICE_NAME + constants.PARAM_MUST_BE_STRING
    },
    impl = {
        validateConfig: function(scriptConfig) {
            // Validate that plugin config exists
            if (!(scriptConfig && scriptConfig.plugins && constants.PLUGIN_NAME in scriptConfig.plugins)) {
                throw new Error(messages.pluginConfigRequired);
            }
            // Validate NAMESPACE
            if (!(constants.PLUGIN_PARAM_SERVICE_NAME in scriptConfig.plugins[constants.PLUGIN_NAME])) {
                throw new Error(messages.pluginParamServiceNameRequired);
            } else if (!('string' === typeof scriptConfig.plugins[constants.PLUGIN_NAME][constants.PLUGIN_PARAM_SERVICE_NAME] ||
                scriptConfig.plugins[constants.PLUGIN_NAME][constants.PLUGIN_PARAM_SERVICE_NAME] instanceof String)) {
                throw new Error(messages.pluginParamServiceNameMustBeString);
            }
        },
        addAmazonSignatureV4: function(serviceName, requestParams, context, ee, callback) {
            var targetUrl = url.parse(requestParams.uri),
                credentials = aws.config.credentials,
                region = aws.config.region,
                end = new aws.Endpoint(targetUrl.hostname),
                req = new aws.HttpRequest(end),
                signer,
                header;

            req.method = requestParams.method;
            req.path = targetUrl.path;
            req.region = region;
            req.headers.Host = end.host;

            for (header in requestParams.headers) {
                req.headers[header] = requestParams.headers[header];
            }

            if (requestParams.body) {
                req.body = requestParams.body;
            } else if (requestParams.json) {
                req.body = JSON.stringify(requestParams.json);
            }

            signer = new aws.Signers.V4(req, serviceName);
            signer.addAuthorization(credentials, new Date());

            for (header in req.headers) {
                requestParams.headers[header] = req.headers[header];
            }

            callback();
        }
    },
    api = {
        init: function(scriptConfig, eventEmitter) {
            var AwsSigV4Plugin = function(scriptConfig, eventEmitter) {
                var serviceName;
                impl.validateConfig(scriptConfig);
                serviceName = scriptConfig.plugins[constants.PLUGIN_NAME][constants.PLUGIN_PARAM_SERVICE_NAME];
                if (!scriptConfig.processor) {
                    scriptConfig.processor = {};
                }
                scriptConfig.processor.addAmazonSignatureV4 = function(requestParams, context, ee, callback) {
                    impl.addAmazonSignatureV4(serviceName, requestParams, context, ee, callback);
                };
            };
            return new AwsSigV4Plugin(scriptConfig, eventEmitter);
        }
    };

module.exports = api.init;

/* test-code */
module.exports.constants = constants;
module.exports.messages = messages;
module.exports.impl = impl;
module.exports.api = api;
/* end-test-code */
