const scripts = require('./nwjs-scripts')

const init = async () => {
	await scripts.inject_js_start()
	await nw.process.mainModule.exports.init()
}
