/**@license
 * RequireJS Hogan Plugin | v0.4.0
 * Author: Miller Medeiros | MIT License
 */
define(['hogan', 'text', 'module'], function(hogan, text, module) {
	var DEFAULT_EXTENSION = '.mustache',
	DEFAULT_DELIMITER = '/',

	_buildMap = {},
	_buildTemplateText =
		'define("{{pluginName}}!{{moduleName}}", ["hogan"{{#partials}}, "{{pluginName}}!{{name}}"{{/partials}}], function(hogan){'+
		'  var tmpl = new hogan.Template({{{fn}}}, "", hogan),'+
		'      extend = function(a, b) { for (var k in b) { a[k] = b[k]; } return a; },'+
		'      parts = { {{#partials}}"{{name}}": arguments[{{order}}].template,{{/partials}} };'+
		'  function render(context, partials, indent) { return tmpl.render(context, extend(parts, partials), indent); }'+
		'  render.template = tmpl;'+
		'  return render;'+
		'});\n',
	_buildTemplate;

	function load(name, req, onLoad, config){
		var pluginConfig = module.config(),
			hgnConfig = config.hgn || pluginConfig,
			fileName = name + (hgnConfig && hgnConfig.templateExtension != null ?
							   hgnConfig.templateExtension :
							   DEFAULT_EXTENSION),
			compilationOptions = hgnConfig.compilationOptions? mixIn({}, hgnConfig.compilationOptions) : {},
			delimiter = hgnConfig.delimiter != null ? hgnConfig.delimiter : DEFAULT_DELIMITER,
			pathPrefix = hgnConfig.pathPrefix,
			basePath;

		if (typeof pathPrefix !== 'string') {
			pathPrefix = null;
		}

		// ensure pathPrefix ends with a trailing delimiter
		if (pathPrefix &&
			pathPrefix.lastIndexOf(delimiter) !== (pathPrefix.length - delimiter.length)) {
			pathPrefix += delimiter;
		}

		basePath = fileName.substring(0, fileName.lastIndexOf('/')+1);

		// load text files with text plugin
		text.get(req.toUrl(fileName), function(data) {
			var compiled = {};

			if (config.isBuild) {
				// store compiled function if build
				// and should always be a string
				compilationOptions.asString = true;
				compiled.asString = hogan.compile(data, compilationOptions);
			}

			// maybe it's required by some other plugin during build
			// so return the compiled template even during build
			var template = hogan.compile(data, compilationOptions),
			render = bind(template.render, template),
			partials = template.partials,
			partialNames = {},
			reqs = [],
		   	p, name;

			// using object map to eliminate duplicates
			for (p in partials) {
				name = partials[p].name;
				partialNames[name] = name;
				// skip if there's no delimiter
				if (!~name.indexOf(delimiter)) { continue; }
				// if using relative path
				if (name.charAt(0) === '.') {
					partialNames[name] = basePath + name;
				}
				else if (pathPrefix && name.charAt(0) !== '/') {
					partialNames[name] = pathPrefix + name;
				}
			}

			compiled.partials = partialNames;
			_buildMap[name] = compiled;

			reqs = keys(partialNames);

			// if there are partials in the template, grab them
			if (reqs.length) {
				return require(map.call(reqs, function(p) { return module.id+'!'+partialNames[p]; }), function() {
					var parts = {},
					wrappedRender = function(context, partials, indent) {
						return render(context, mixIn(parts, partials), indent);
					};

					for (var i=0; i < reqs.length; ++i) {
						parts[reqs[i]] = arguments[i].template;
					}
					wrappedRender.text = template.text;
					wrappedRender.template = template;
					onLoad(wrappedRender);
				})
			}

			// add text property for debugging if needed.
			// it's important to notice that this value won't be available
			// after build.
			render.text = template.text;
			render.template = template;
			// return just the render method so it's easier to use
			onLoad(render);
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
			if (Object.prototype.hasOwnProperty.call(source, key)) {
				target[key] = source[key];
			}
		}
		return target;
	}

	function keys(obj) {
		var keys = [], i;
		for (i in obj) { keys.push(i); }
		return keys;
	}

	// Array.prototype.map() polyfill from
	// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/map
	function map(fun /*, thisArg */) {
		if (this === void 0 || this === null) {
			throw new TypeError();
		}

		var t = Object(this);
		var len = t.length >>> 0;
		if (typeof fun !== "function") {
			throw new TypeError();
		}

		var res = new Array(len);
		var thisArg = arguments.length >= 2 ? arguments[1] : void 0;
		for (var i = 0; i < len; i++) {
			// NOTE: Absolute correctness would demand Object.defineProperty
			//       be used.  But this method is fairly new, and failure is
			//       possible only if Object.prototype or Array.prototype
			//       has a property |i| (very unlikely), so use a less-correct
			//       but more portable alternative.
			if (i in t) {
				res[i] = fun.call(thisArg, t[i], i, t);
			}
		}

		return res;
	}

	function write(pluginName, moduleName, writeModule){
		if (moduleName in _buildMap){
			if (!_buildTemplate) {
				// using templates to generate compiled templates, so meta :P
				_buildTemplate = hogan.compile(_buildTemplateText);
			}
			var compiled = _buildMap[moduleName],
			partials = [],
			p;

			for (p in compiled.partials) {
				partials.push({
					name: p,
					path: compiled.partials[p],
				   	order: partials.length+1
			   	});
			}

			writeModule(_buildTemplate.render({
				pluginName: pluginName,
				moduleName: moduleName,
				partials: partials,
				fn: compiled.asString
			}));
		}
	}

	return {
		load: load,
		write: write
	};
});
