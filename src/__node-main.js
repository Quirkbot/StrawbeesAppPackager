const path = require('path')
const http = require('http')
const fs = require('fs').promises
const pkg = require('./package.json')
const scripts = require('./nwjs-scripts')

const autoupdate = async () => {
	if(process.platform == 'linux'){
		throw new Error('Linux does not support auto update')
	}
	const UPDATES_MANIFEST_URL = `${config.updates.default}/${process.platform}/latest.json`
	const UPDATES_DIR = path.resolve(require('os').tmpdir(), pkg['executable-name'])
	const UPDATER_BIN_NAME = /^win/.test(process.platform) ? 'updater.exe' : 'updater'

	// Download manifest
	console.log(`AUTOUPDATE: Downloading manifest from: ${UPDATES_MANIFEST_URL}...`)
	const manifest = await (await fetch(UPDATES_MANIFEST_URL)).json()
	if(manifest.version == pkg.version) {
		throw new Error('App is up to date!')
	}
	console.log('AUTOUPDATE: Update manifest', manifest)

	// Make update temp directory
	console.log(`AUTOUPDATE: Using update directory: ${UPDATES_DIR}`)
	//.then(utils.mkdir(UPDATES_DIR))

	// // Donwload the src (or skip if already donwloaded)
	// .then(utils.logLabel('AUTOUPDATE: Grabbing source...'))
	// .then(manifest => {
	// 	return new Promise((resolve, reject) => {
	// 		const sourceTempDest = path.resolve(UPDATES_DIR, '.update.zip')
	// 		const sourceFinalDest = path.resolve(UPDATES_DIR, `${manifest.version}.zip`)
	// 		const sourceUrl = `${config.updates.default}/${process.platform}/${manifest.src.path}`
	// 		utils.pass(manifest)
	// 		.then(utils.checkStat(sourceFinalDest))
	// 		.then(utils.logLabel(`AUTOUPDATE: Source already downloaded at ${sourceFinalDest}`))
	// 		.then(() => resolve(manifest))
	// 		.catch(() => {
	// 			utils.pass()
	// 			.then(utils.logLabel(`AUTOUPDATE: Clearing temp destination: ${sourceTempDest}`))
	// 			.then(utils.deleteFile(sourceTempDest))
	// 			.then(utils.logLabel(`AUTOUPDATE: Downloading source from: ${sourceUrl}`))
	// 			.then(() => {
	// 				return new Promise((resolve, reject) =>{
	// 					const http = /^https/.test(sourceUrl) ? require('https') : require('http')
	// 					http.get(sourceUrl, res => {
	// 						if (res.statusCode !== 200) {
	// 							return reject(new Error(res.statusMessage))
	// 						}
	// 						res.pipe(fs.createWriteStream(sourceTempDest))
	// 						.on('finish', () => {
	// 							utils.pass(manifest)
	// 							.then(utils.logLabel('AUTOUPDATE: Moving source from temporary to final destination'))
	// 							.then(utils.moveFile(
	// 								sourceTempDest,
	// 								sourceFinalDest
	// 							))
	// 							.then(resolve)
	// 							.catch(reject)
	// 						})
	// 						.on('error', err => reject(err))
	// 					})
	// 				})
	// 			})
	// 			.then(utils.logLabel('AUTOUPDATE: Source successfully donwloaded!'))
	// 			.then(resolve)
	// 			.catch(reject)
	// 		})
	// 	})
	// })
	// // Notify user about the update
	// .then(utils.logLabel('AUTOUPDATE: Displaying notification to user...'))
	// .then(manifest => {
	// 	return new Promise((resolve, reject) => {
	// 		const options = {
	// 			icon: 'assets/icon.png',
	// 			body: 'Click here to install',
	// 			requireInteraction: true
	// 		}
	// 		const notification = new Notification('A new update is available!', options)
	// 		notification.onclick = () => {
	// 			notification.close()
	// 			resolve(manifest)
	// 		}
	// 		notification.onclose = () => reject('User closed the update notification.')
	// 	})
	// })
	// // Copy the update binary to the update dir
	// .then(utils.logLabel(`AUTOUPDATE: Moving updater binary to ${path.resolve(UPDATES_DIR, UPDATER_BIN_NAME)}`))
	// .then(utils.copyFile(
	// 	path.resolve(UPDATER_BIN_NAME),
	// 	path.resolve(UPDATES_DIR, UPDATER_BIN_NAME)
	// ))
	// .then(utils.chmod(
	// 	path.resolve(UPDATES_DIR, UPDATER_BIN_NAME),
	// 	755 & ~process.umask()
	// ))
	// // Run the update binary
	// .then(manifest => {
	// 	let instDir
	// 	switch (process.platform) {
	// 	case 'darwin':
	// 		instDir = path.resolve('./../../../../')
	// 		break
	// 	case 'win32':
	// 		instDir = path.resolve('./')
	// 		break
	// 	}
	// 	const args = [
	// 		path.resolve(UPDATES_DIR, UPDATER_BIN_NAME),
	// 		[
	// 			'--bundle', path.resolve(UPDATES_DIR, `${manifest.version}.zip`),
	// 			'--inst-dir', instDir,
	// 			'--app-name', pkg['executable-name']
	// 		],
	// 		{
	// 			cwd: path.dirname(UPDATES_DIR),
	// 			detached: true,
	// 			stdio: 'ignore',
	// 		}
	// 	]
	// 	return utils.pass()
	// 	.then(utils.logLabel(`AUTOUPDATE: Running updater:\n${JSON.stringify(args)}`))
	// 	.then(() => require('child_process').spawn.apply(this, args).unref())
	// })
	// .then(utils.logLabel('AUTOUPDATE: Quitting app...'))
	// .then(() => window.nw.App.quit())
	// .catch(error => console.error('AUTOUPDATE: Canceled.', error))
}

exports.init = async () => {
	// Graceful shutdown, kind of
	process.on('SIGQUIT', () => process.exit())
	process.on('SIGHUP', () => process.exit())
	process.on('SIGINT', () => process.exit()) // catch ctrl-c
	process.on('SIGTERM', () => process.exit()) // catch kill

	// run the app's main script
	await scripts.main()

	// autoupdate
	autoupdate()
}
