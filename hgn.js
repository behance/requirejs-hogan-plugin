/**@license
 * RequireJS Hogan Plugin | v0.3.0 (2013/06/11)
 * Author: Miller Medeiros | MIT License
 */
define(['hogan', 'text', 'module'], function (hogan, text, module) {

    var DEFAULT_EXTENSION = '.mustache';
    var DEFAULT_PATH_PREFIX = '';
    var DEFAULT_PATH_SEPARATOR = '/';

    var pluginConfig = module.config();
    var _buildMap = {};
    var _buildTemplateText = 'define("{{pluginName}}!{{moduleName}}", ["hogan"], function(hogan){'+
                             '  var tmpl = new hogan.Template({{{fn}}}, "", hogan);'+
                             // need to use apply to bind the proper scope.
                             '  function render(){ return tmpl.render.apply(tmpl, arguments); } render.template = tmpl; return render;'+
                             '});\n';
    var _buildTemplate;

    function load(name, req, onLoad, config) {
        // load text files with text plugin
        getTemplateText(name, req, pluginConfig, function(data){
            var compilationOptions = mixIn({}, pluginConfig.compilationOptions);

            if (config.isBuild) {
                // store compiled function if build
                // and should always be a string
                compilationOptions.asString = true;
                _buildMap[name] = hogan.compile(data, compilationOptions);
            }

            // maybe it's required by some other plugin during build
            // so return the compiled template even during build
            var template = hogan.compile(data, compilationOptions);
            var render = bind(template.render, template);
            // add text property for debugging if needed.
            // it's important to notice that this value won't be available
            // after build.
            render.text = template.text;
            render.template = template;
            // return just the render method so it's easier to use
            onLoad( render );
        });
    }

    function inlinePartials(templateText, req, hgnConfig, callback) {
        var pathPrefix = hgnConfig.pathPrefix != null ?  hgnConfig.pathPrefix : DEFAULT_PATH_PREFIX,
            pathSeparator = hgnConfig.pathSeparator || DEFAULT_PATH_SEPARATOR,
            partials = getPartialPaths(templateText, pathPrefix, pathSeparator),
            done = 0, i;

        if (!partials.length) {
            callback(templateText);
        }

        var inlinePartial = function(name) {
            getTemplateText(name, req, hgnConfig, function(partialTemplateText) {
                var regexp = new RegExp('{{> *' + regexEscape(name.substring(pathPrefix.length).replace('/', pathSeparator)) + ' *}}');
                templateText = templateText.replace(regexp, partialTemplateText);
                if (++done === partials.length) {
                  callback(templateText);
                }
            });
        };

        for (i = 0; i < partials.length; i++) {
            inlinePartial(partials[i]);
        }
    }

    function regexEscape(str) {
        return str.replace(/([.?*+^$[\]\\(){}|-])/g, "\\$1");
    }

    function getPartialPaths(templateText, pathPrefix, pathSeparator) {
        var tokens = hogan.scan(templateText),
            tokenLength = tokens.length,
            partials = [], i;

        for (i = 0; i < tokenLength; i++) {
            if (tokens[i].tag === '>' && ~tokens[i].n.indexOf(pathSeparator)) {
              partials.push(pathPrefix + tokens[i].n.replace(pathSeparator, '/'));
            }
        }

        return partials;
    }

    function getTemplateText(name, req, hgnConfig, callback) {
        var fileName = name + (hgnConfig.templateExtension != null ?
                               hgnConfig.templateExtension :
                               DEFAULT_EXTENSION);

        text.get(req.toUrl(fileName), function(data){
            inlinePartials(data, req, hgnConfig, callback);
        });
    }

    function bind(fn, context) {
        return function(){
            return fn.apply(context, arguments);
        };
    }

    function mixIn(target, source) {
        var key;
        for (key in source){
            if ( Object.prototype.hasOwnProperty.call(source, key) ) {
                target[key] = source[key];
            }
        }
        return target;
    }

    function write(pluginName, moduleName, writeModule){
        if(moduleName in _buildMap){
            if (! _buildTemplate) {
                // using templates to generate compiled templates, so meta :P
                _buildTemplate = hogan.compile( _buildTemplateText );
            }
            var fn = _buildMap[moduleName];
            writeModule( _buildTemplate.render({
                pluginName : pluginName,
                moduleName : moduleName,
                fn : fn
            }) );
        }
    }

    return {
        load : load,
        write : write
    };

});
