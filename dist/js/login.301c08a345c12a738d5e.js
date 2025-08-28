/*
 * ATTENTION: The "eval" devtool has been used (maybe by default in mode: "development").
 * This devtool is neither made for production nor for readable output files.
 * It uses "eval()" calls to create a separate source file in the browser devtools.
 * If you are trying to read the output file, select a different devtool (https://webpack.js.org/configuration/devtool/)
 * or disable the default devtool with "devtool: false".
 * If you are looking for production-ready output files, see mode: "production" (https://webpack.js.org/configuration/mode/).
 */
/******/ (() => { // webpackBootstrap
/******/ 	var __webpack_modules__ = ({

/***/ "./src/js/config.js":
/*!**************************!*\
  !*** ./src/js/config.js ***!
  \**************************/
/***/ (() => {

eval("{function _typeof(o) { \"@babel/helpers - typeof\"; return _typeof = \"function\" == typeof Symbol && \"symbol\" == typeof Symbol.iterator ? function (o) { return typeof o; } : function (o) { return o && \"function\" == typeof Symbol && o.constructor === Symbol && o !== Symbol.prototype ? \"symbol\" : typeof o; }, _typeof(o); }\nfunction _regenerator() { /*! regenerator-runtime -- Copyright (c) 2014-present, Facebook, Inc. -- license (MIT): https://github.com/babel/babel/blob/main/packages/babel-helpers/LICENSE */ var e, t, r = \"function\" == typeof Symbol ? Symbol : {}, n = r.iterator || \"@@iterator\", o = r.toStringTag || \"@@toStringTag\"; function i(r, n, o, i) { var c = n && n.prototype instanceof Generator ? n : Generator, u = Object.create(c.prototype); return _regeneratorDefine2(u, \"_invoke\", function (r, n, o) { var i, c, u, f = 0, p = o || [], y = !1, G = { p: 0, n: 0, v: e, a: d, f: d.bind(e, 4), d: function d(t, r) { return i = t, c = 0, u = e, G.n = r, a; } }; function d(r, n) { for (c = r, u = n, t = 0; !y && f && !o && t < p.length; t++) { var o, i = p[t], d = G.p, l = i[2]; r > 3 ? (o = l === n) && (u = i[(c = i[4]) ? 5 : (c = 3, 3)], i[4] = i[5] = e) : i[0] <= d && ((o = r < 2 && d < i[1]) ? (c = 0, G.v = n, G.n = i[1]) : d < l && (o = r < 3 || i[0] > n || n > l) && (i[4] = r, i[5] = n, G.n = l, c = 0)); } if (o || r > 1) return a; throw y = !0, n; } return function (o, p, l) { if (f > 1) throw TypeError(\"Generator is already running\"); for (y && 1 === p && d(p, l), c = p, u = l; (t = c < 2 ? e : u) || !y;) { i || (c ? c < 3 ? (c > 1 && (G.n = -1), d(c, u)) : G.n = u : G.v = u); try { if (f = 2, i) { if (c || (o = \"next\"), t = i[o]) { if (!(t = t.call(i, u))) throw TypeError(\"iterator result is not an object\"); if (!t.done) return t; u = t.value, c < 2 && (c = 0); } else 1 === c && (t = i[\"return\"]) && t.call(i), c < 2 && (u = TypeError(\"The iterator does not provide a '\" + o + \"' method\"), c = 1); i = e; } else if ((t = (y = G.n < 0) ? u : r.call(n, G)) !== a) break; } catch (t) { i = e, c = 1, u = t; } finally { f = 1; } } return { value: t, done: y }; }; }(r, o, i), !0), u; } var a = {}; function Generator() {} function GeneratorFunction() {} function GeneratorFunctionPrototype() {} t = Object.getPrototypeOf; var c = [][n] ? t(t([][n]())) : (_regeneratorDefine2(t = {}, n, function () { return this; }), t), u = GeneratorFunctionPrototype.prototype = Generator.prototype = Object.create(c); function f(e) { return Object.setPrototypeOf ? Object.setPrototypeOf(e, GeneratorFunctionPrototype) : (e.__proto__ = GeneratorFunctionPrototype, _regeneratorDefine2(e, o, \"GeneratorFunction\")), e.prototype = Object.create(u), e; } return GeneratorFunction.prototype = GeneratorFunctionPrototype, _regeneratorDefine2(u, \"constructor\", GeneratorFunctionPrototype), _regeneratorDefine2(GeneratorFunctionPrototype, \"constructor\", GeneratorFunction), GeneratorFunction.displayName = \"GeneratorFunction\", _regeneratorDefine2(GeneratorFunctionPrototype, o, \"GeneratorFunction\"), _regeneratorDefine2(u), _regeneratorDefine2(u, o, \"Generator\"), _regeneratorDefine2(u, n, function () { return this; }), _regeneratorDefine2(u, \"toString\", function () { return \"[object Generator]\"; }), (_regenerator = function _regenerator() { return { w: i, m: f }; })(); }\nfunction _regeneratorDefine2(e, r, n, t) { var i = Object.defineProperty; try { i({}, \"\", {}); } catch (e) { i = 0; } _regeneratorDefine2 = function _regeneratorDefine(e, r, n, t) { function o(r, n) { _regeneratorDefine2(e, r, function (e) { return this._invoke(r, n, e); }); } r ? i ? i(e, r, { value: n, enumerable: !t, configurable: !t, writable: !t }) : e[r] = n : (o(\"next\", 0), o(\"throw\", 1), o(\"return\", 2)); }, _regeneratorDefine2(e, r, n, t); }\nfunction ownKeys(e, r) { var t = Object.keys(e); if (Object.getOwnPropertySymbols) { var o = Object.getOwnPropertySymbols(e); r && (o = o.filter(function (r) { return Object.getOwnPropertyDescriptor(e, r).enumerable; })), t.push.apply(t, o); } return t; }\nfunction _objectSpread(e) { for (var r = 1; r < arguments.length; r++) { var t = null != arguments[r] ? arguments[r] : {}; r % 2 ? ownKeys(Object(t), !0).forEach(function (r) { _defineProperty(e, r, t[r]); }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(e, Object.getOwnPropertyDescriptors(t)) : ownKeys(Object(t)).forEach(function (r) { Object.defineProperty(e, r, Object.getOwnPropertyDescriptor(t, r)); }); } return e; }\nfunction _defineProperty(e, r, t) { return (r = _toPropertyKey(r)) in e ? Object.defineProperty(e, r, { value: t, enumerable: !0, configurable: !0, writable: !0 }) : e[r] = t, e; }\nfunction _toPropertyKey(t) { var i = _toPrimitive(t, \"string\"); return \"symbol\" == _typeof(i) ? i : i + \"\"; }\nfunction _toPrimitive(t, r) { if (\"object\" != _typeof(t) || !t) return t; var e = t[Symbol.toPrimitive]; if (void 0 !== e) { var i = e.call(t, r || \"default\"); if (\"object\" != _typeof(i)) return i; throw new TypeError(\"@@toPrimitive must return a primitive value.\"); } return (\"string\" === r ? String : Number)(t); }\nfunction asyncGeneratorStep(n, t, e, r, o, a, c) { try { var i = n[a](c), u = i.value; } catch (n) { return void e(n); } i.done ? t(u) : Promise.resolve(u).then(r, o); }\nfunction _asyncToGenerator(n) { return function () { var t = this, e = arguments; return new Promise(function (r, o) { var a = n.apply(t, e); function _next(n) { asyncGeneratorStep(a, r, o, _next, _throw, \"next\", n); } function _throw(n) { asyncGeneratorStep(a, r, o, _next, _throw, \"throw\", n); } _next(void 0); }); }; }\n// API Configuration\nvar API_CONFIG = {\n  // Backend API base URL - Update these URLs to point to your backend\n  BASE_URL: window.location.hostname === \"localhost\" ? \"\" // Local development - use webpack dev server proxy\n  : \"https://rental-management-backend-mocha.vercel.app\",\n  // Production backend URL - Vercel deployment\n\n  // API endpoints\n  ENDPOINTS: {\n    // Authentication\n    LOGIN: \"/api/auth/login\",\n    LOGOUT: \"/api/auth/logout\",\n    STATUS: \"/api/auth/status\",\n    ME: \"/api/auth/me\",\n    // Properties\n    PROPERTIES: \"/api/properties\",\n    PROPERTY_BY_ID: function PROPERTY_BY_ID(id) {\n      return \"/api/properties/\".concat(id);\n    },\n    PROPERTY_TENANTS: function PROPERTY_TENANTS(id) {\n      return \"/api/properties/\".concat(id, \"/tenants\");\n    },\n    PROPERTY_STATS: \"/api/properties/stats/summary\",\n    // Tenants\n    TENANTS: \"/api/tenants\",\n    TENANT_BY_ID: function TENANT_BY_ID(id) {\n      return \"/api/tenants/\".concat(id);\n    },\n    TENANT_BY_FIN: function TENANT_BY_FIN(fin) {\n      return \"/api/tenants/fin/\".concat(fin);\n    },\n    TENANT_STATS: \"/api/tenants/stats/summary\",\n    TENANT_ADD_PROPERTY: function TENANT_ADD_PROPERTY(id) {\n      return \"/api/tenants/\".concat(id, \"/properties\");\n    },\n    TENANT_REMOVE_PROPERTY: function TENANT_REMOVE_PROPERTY(id, propertyId) {\n      return \"/api/tenants/\".concat(id, \"/properties/\").concat(propertyId);\n    },\n    // File Upload\n    UPLOAD: \"/api/upload\",\n    UPLOAD_MULTIPLE: \"/api/upload/multiple\",\n    UPLOAD_TENANT_DOCUMENT: \"/api/upload/tenant-document\",\n    // Analytics\n    DASHBOARD_ANALYTICS: \"/api/analysis/dashboard\",\n    PROPERTY_PERFORMANCE: \"/api/analysis/property-performance\",\n    TENANT_INSIGHTS: \"/api/analysis/tenant-insights\",\n    // Investors\n    INVESTORS: \"/api/investors\",\n    INVESTOR_BY_ID: function INVESTOR_BY_ID(id) {\n      return \"/api/investors/\".concat(id);\n    },\n    INVESTORS_BY_PROPERTY: function INVESTORS_BY_PROPERTY(propertyId) {\n      return \"/api/investors/property/\".concat(propertyId);\n    },\n    INVESTOR_ADD_PROPERTY: function INVESTOR_ADD_PROPERTY(investorId) {\n      return \"/api/investors/\".concat(investorId, \"/properties\");\n    },\n    INVESTOR_REMOVE_PROPERTY: function INVESTOR_REMOVE_PROPERTY(investorId, propertyId) {\n      return \"/api/investors/\".concat(investorId, \"/properties/\").concat(propertyId);\n    },\n    // Financial Reports\n    FINANCIAL_REPORTS_BY_PROPERTY: function FINANCIAL_REPORTS_BY_PROPERTY(propertyId) {\n      return \"/api/financial-reports/property/\".concat(propertyId);\n    },\n    FINANCIAL_REPORT: function FINANCIAL_REPORT(propertyId, year, month) {\n      return \"/api/financial-reports/property/\".concat(propertyId, \"/\").concat(year, \"/\").concat(month);\n    },\n    FINANCIAL_REPORT_INCOME: function FINANCIAL_REPORT_INCOME(propertyId, year, month) {\n      return \"/api/financial-reports/property/\".concat(propertyId, \"/\").concat(year, \"/\").concat(month, \"/income\");\n    },\n    FINANCIAL_REPORT_EXPENSES: function FINANCIAL_REPORT_EXPENSES(propertyId, year, month) {\n      return \"/api/financial-reports/property/\".concat(propertyId, \"/\").concat(year, \"/\").concat(month, \"/expenses\");\n    },\n    // Health Check\n    HEALTH: \"/health\"\n  }\n};\n\n// Helper function to build full API URL\nvar buildApiUrl = function buildApiUrl(endpoint) {\n  return \"\".concat(API_CONFIG.BASE_URL).concat(endpoint);\n};\n\n// Default fetch options with credentials for cookies and auth token\nvar defaultFetchOptions = {\n  credentials: \"include\",\n  headers: {\n    \"Content-Type\": \"application/json\"\n  }\n};\n\n// Function to get auth token from storage (checks both localStorage and sessionStorage)\nvar getAuthToken = function getAuthToken() {\n  // First check localStorage (persistent storage)\n  var token = localStorage.getItem('authToken');\n\n  // Check if localStorage token is expired\n  if (token) {\n    var expiration = localStorage.getItem('authExpiration');\n    if (expiration && Date.now() > parseInt(expiration)) {\n      // Token expired, clear it\n      clearAuth();\n      token = null;\n    }\n  }\n\n  // If no persistent token, check sessionStorage (temporary storage)\n  if (!token) {\n    token = sessionStorage.getItem('authToken');\n  }\n  return token;\n};\n\n// Function to get auth headers including token\nvar getAuthHeaders = function getAuthHeaders() {\n  var headers = {\n    \"Content-Type\": \"application/json\"\n  };\n  var token = getAuthToken();\n  if (token) {\n    headers['Authorization'] = \"Bearer \".concat(token);\n  }\n  return headers;\n};\n\n// API helper functions\nvar API = {\n  get: function () {\n    var _get = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee(endpoint) {\n      var options,\n        response,\n        _args = arguments;\n      return _regenerator().w(function (_context) {\n        while (1) switch (_context.n) {\n          case 0:\n            options = _args.length > 1 && _args[1] !== undefined ? _args[1] : {};\n            _context.n = 1;\n            return fetch(buildApiUrl(endpoint), _objectSpread({\n              method: \"GET\",\n              credentials: \"include\",\n              headers: _objectSpread(_objectSpread({}, getAuthHeaders()), options.headers || {})\n            }, options));\n          case 1:\n            response = _context.v;\n            return _context.a(2, response);\n        }\n      }, _callee);\n    }));\n    function get(_x) {\n      return _get.apply(this, arguments);\n    }\n    return get;\n  }(),\n  post: function () {\n    var _post = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee2(endpoint) {\n      var data,\n        options,\n        response,\n        _args2 = arguments;\n      return _regenerator().w(function (_context2) {\n        while (1) switch (_context2.n) {\n          case 0:\n            data = _args2.length > 1 && _args2[1] !== undefined ? _args2[1] : null;\n            options = _args2.length > 2 && _args2[2] !== undefined ? _args2[2] : {};\n            _context2.n = 1;\n            return fetch(buildApiUrl(endpoint), _objectSpread({\n              method: \"POST\",\n              credentials: \"include\",\n              headers: _objectSpread(_objectSpread({}, getAuthHeaders()), options.headers || {}),\n              body: data ? JSON.stringify(data) : null\n            }, options));\n          case 1:\n            response = _context2.v;\n            return _context2.a(2, response);\n        }\n      }, _callee2);\n    }));\n    function post(_x2) {\n      return _post.apply(this, arguments);\n    }\n    return post;\n  }(),\n  put: function () {\n    var _put = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee3(endpoint) {\n      var data,\n        options,\n        response,\n        _args3 = arguments;\n      return _regenerator().w(function (_context3) {\n        while (1) switch (_context3.n) {\n          case 0:\n            data = _args3.length > 1 && _args3[1] !== undefined ? _args3[1] : null;\n            options = _args3.length > 2 && _args3[2] !== undefined ? _args3[2] : {};\n            _context3.n = 1;\n            return fetch(buildApiUrl(endpoint), _objectSpread({\n              method: \"PUT\",\n              credentials: \"include\",\n              headers: _objectSpread(_objectSpread({}, getAuthHeaders()), options.headers || {}),\n              body: data ? JSON.stringify(data) : null\n            }, options));\n          case 1:\n            response = _context3.v;\n            return _context3.a(2, response);\n        }\n      }, _callee3);\n    }));\n    function put(_x3) {\n      return _put.apply(this, arguments);\n    }\n    return put;\n  }(),\n  \"delete\": function () {\n    var _delete2 = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee4(endpoint) {\n      var options,\n        response,\n        _args4 = arguments;\n      return _regenerator().w(function (_context4) {\n        while (1) switch (_context4.n) {\n          case 0:\n            options = _args4.length > 1 && _args4[1] !== undefined ? _args4[1] : {};\n            _context4.n = 1;\n            return fetch(buildApiUrl(endpoint), _objectSpread({\n              method: \"DELETE\",\n              credentials: \"include\",\n              headers: _objectSpread(_objectSpread({}, getAuthHeaders()), options.headers || {})\n            }, options));\n          case 1:\n            response = _context4.v;\n            return _context4.a(2, response);\n        }\n      }, _callee4);\n    }));\n    function _delete(_x4) {\n      return _delete2.apply(this, arguments);\n    }\n    return _delete;\n  }()\n};\n\n// Helper function to clear authentication\nvar clearAuth = function clearAuth() {\n  // Clear localStorage\n  localStorage.removeItem('authToken');\n  localStorage.removeItem('user');\n  localStorage.removeItem('rememberMe');\n  localStorage.removeItem('loginTime');\n  localStorage.removeItem('authExpiration');\n\n  // Clear sessionStorage\n  sessionStorage.removeItem('authToken');\n  sessionStorage.removeItem('user');\n  sessionStorage.removeItem('rememberMe');\n};\n\n// Export for use in other files\nwindow.API_CONFIG = API_CONFIG;\nwindow.buildApiUrl = buildApiUrl;\nwindow.API = API;\nwindow.getAuthToken = getAuthToken;\nwindow.getAuthHeaders = getAuthHeaders;\nwindow.clearAuth = clearAuth;\n\n//# sourceURL=webpack://rental-management-platform/./src/js/config.js?\n}");

/***/ }),

/***/ "./src/js/login.js":
/*!*************************!*\
  !*** ./src/js/login.js ***!
  \*************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
eval("{__webpack_require__.r(__webpack_exports__);\n/* harmony import */ var _config_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./config.js */ \"./src/js/config.js\");\n/* harmony import */ var _config_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(_config_js__WEBPACK_IMPORTED_MODULE_0__);\n// Login entry point\n\n\n//# sourceURL=webpack://rental-management-platform/./src/js/login.js?\n}");

/***/ })

/******/ 	});
/************************************************************************/
/******/ 	// The module cache
/******/ 	var __webpack_module_cache__ = {};
/******/ 	
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/ 		// Check if module is in cache
/******/ 		var cachedModule = __webpack_module_cache__[moduleId];
/******/ 		if (cachedModule !== undefined) {
/******/ 			return cachedModule.exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = __webpack_module_cache__[moduleId] = {
/******/ 			// no module.id needed
/******/ 			// no module.loaded needed
/******/ 			exports: {}
/******/ 		};
/******/ 	
/******/ 		// Execute the module function
/******/ 		__webpack_modules__[moduleId](module, module.exports, __webpack_require__);
/******/ 	
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/ 	
/************************************************************************/
/******/ 	/* webpack/runtime/compat get default export */
/******/ 	(() => {
/******/ 		// getDefaultExport function for compatibility with non-harmony modules
/******/ 		__webpack_require__.n = (module) => {
/******/ 			var getter = module && module.__esModule ?
/******/ 				() => (module['default']) :
/******/ 				() => (module);
/******/ 			__webpack_require__.d(getter, { a: getter });
/******/ 			return getter;
/******/ 		};
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/define property getters */
/******/ 	(() => {
/******/ 		// define getter functions for harmony exports
/******/ 		__webpack_require__.d = (exports, definition) => {
/******/ 			for(var key in definition) {
/******/ 				if(__webpack_require__.o(definition, key) && !__webpack_require__.o(exports, key)) {
/******/ 					Object.defineProperty(exports, key, { enumerable: true, get: definition[key] });
/******/ 				}
/******/ 			}
/******/ 		};
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/hasOwnProperty shorthand */
/******/ 	(() => {
/******/ 		__webpack_require__.o = (obj, prop) => (Object.prototype.hasOwnProperty.call(obj, prop))
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/make namespace object */
/******/ 	(() => {
/******/ 		// define __esModule on exports
/******/ 		__webpack_require__.r = (exports) => {
/******/ 			if(typeof Symbol !== 'undefined' && Symbol.toStringTag) {
/******/ 				Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
/******/ 			}
/******/ 			Object.defineProperty(exports, '__esModule', { value: true });
/******/ 		};
/******/ 	})();
/******/ 	
/************************************************************************/
/******/ 	
/******/ 	// startup
/******/ 	// Load entry module and return exports
/******/ 	// This entry module can't be inlined because the eval devtool is used.
/******/ 	var __webpack_exports__ = __webpack_require__("./src/js/login.js");
/******/ 	
/******/ })()
;