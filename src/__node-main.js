// Graceful shutdown, kind of
process.on('SIGQUIT', () => process.exit())
process.on('SIGHUP', () => process.exit())
process.on('SIGINT', () => process.exit()) // catch ctrl-c
process.on('SIGTERM', () => process.exit()) // catch kill

// import local node-main
try {
	require('./nwjs-scripts/node-main')
} catch (e) {
	console.log('Error loading nwjs-scripts/node-main.js', e)
}

const path = require('path')
const httpServer = require('http')
const httpsServer = require('https')
const os = require('os')
const fs = require('fs')
const childProcess = require('child_process')
const compareVersions = require('./__compareVersions')
const pkg = require('./package.json')

const autoupdate = async () => {
	/* eslint-disable no-console */
	if (process.platform === 'linux') {
		throw new Error('Linux does not support auto update')
	}
	const UPDATES_MANIFEST_URL = `${pkg.autoupdate}/${process.platform}/${process.arch}/latest.json`
	const UPDATES_DIR = path.resolve(os.tmpdir(), pkg['executable-name'])
	const UPDATER_BIN_NAME = `updater-${process.arch}${/^win/.test(process.platform) ? '.exe' : ''}`

	// create restart rotine
	const restart = async () => {
		// Copy the update binary to the update dir
		console.log(`AUTOUPDATE: Moving updater binary to ${path.resolve(UPDATES_DIR, UPDATER_BIN_NAME)}`)
		await fs.promises.copyFile(
			path.resolve(UPDATER_BIN_NAME),
			path.resolve(UPDATES_DIR, UPDATER_BIN_NAME)
		)
		await fs.promises.chmod(
			path.resolve(UPDATES_DIR, UPDATER_BIN_NAME),
			755 & ~process.umask()
		)
		// Run the update binary
		let instDir
		switch (process.platform) {
			case 'darwin':
				instDir = path.resolve('./../../../../')
				break
			case 'win32':
				instDir = path.resolve('./')
				break
			default:
				break
		}
		const args = [
			path.resolve(UPDATES_DIR, UPDATER_BIN_NAME),
			[
				'--bundle', path.resolve(UPDATES_DIR, `${manifest.version}.zip`),
				'--inst-dir', instDir,
				'--app-name', pkg['executable-name']
			],
			{
				cwd      : path.dirname(UPDATES_DIR),
				detached : true,
				stdio    : 'ignore',
			}
		]
		console.log(`AUTOUPDATE: Running updater:\n${JSON.stringify(args)}`)
		childProcess.spawn.apply(this, args).unref()

		// Quit the app
		console.log('AUTOUPDATE: Quitting app...')
		nw.App.quit()
	}

	// Download manifest
	console.log(`AUTOUPDATE: Downloading manifest from: ${UPDATES_MANIFEST_URL}...`)
	const manifest = await (await fetch(`${UPDATES_MANIFEST_URL}?${Date.now()}`)).json()
	console.log('AUTOUPDATE: Manifest version - ', manifest.version)
	console.log('AUTOUPDATE: Package version - ', pkg.version)
	if (compareVersions(pkg.version, manifest.version) >= 0) {
		throw new Error('App is up to date!')
	}
	console.log('AUTOUPDATE: Update manifest', manifest)

	// Make update temp directory
	console.log(`AUTOUPDATE: Using update directory: ${UPDATES_DIR}`)
	try {
		await fs.promises.mkdir(UPDATES_DIR, { recursive : true })
	} catch (e) {
		console.log('AUTOUPDATE: Error creating update dir')
	}

	// Donwload the src (or skip if already donwloaded)
	console.log('AUTOUPDATE: Grabbing source...')

	const sourceTempDest = path.resolve(UPDATES_DIR, '.update.zip')
	const sourceFinalDest = path.resolve(UPDATES_DIR, `${manifest.version}.zip`)
	const sourceUrl = `${pkg.autoupdate}/${process.platform}/${process.arch}/${manifest.src.path}`

	// ... check if already src alaready exists
	try {
		await fs.promises.access(sourceFinalDest)
		console.log(`AUTOUPDATE: Source already downloaded at ${sourceFinalDest}`)
		// ... do the restart straight away
		return restart()
	} catch (error) {}

	console.log(`AUTOUPDATE: Clearing temp destination: ${sourceTempDest}`)
	try {
		await fs.promises.unlink(sourceTempDest)
	} catch (e) {}

	console.log(`AUTOUPDATE: Downloading source from: ${sourceUrl}`)
	await new Promise((resolve, reject) => {
		const http = /^https/.test(sourceUrl) ? httpsServer : httpServer
		http.get(sourceUrl, res => {
			if (res.statusCode !== 200) {
				return reject(new Error(res.statusMessage))
			}
			res.pipe(fs.createWriteStream(sourceTempDest))
				.on('finish', async () => {
					console.log('AUTOUPDATE: Moving source from temporary to final destination')
					try {
						await fs.promises.rename(sourceTempDest, sourceFinalDest)
						resolve()
					} catch (e) {
						reject(e)
					}
				})
				.on('error', err => reject(err))
			return null
		})
	})
	console.log('AUTOUPDATE: Source successfully donwloaded!')


	// Notify user about the update
	console.log('AUTOUPDATE: Displaying notification to user...')
	await new Promise((resolve, reject) => {
		const options = {
			icon : 'nwjs-assets/icon.png',
			body : 'Click here to restart',
			// requireInteraction : true
		}
		const notification = new Notification('Update ready to install', options)
		const timer = setTimeout(() => {
			notification.close()
			reject(new Error('AUTOUPDATE: Notification timed out'))
		}, 5000)
		notification.onclick = () => {
			notification.close()
			clearTimeout(timer)
			resolve()
		}
		notification.onclose = () => {
			clearTimeout(timer)
			reject(new Error('AUTOUPDATE: User closed the notification.'))
		}
	})

	// Restart
	await restart()
}
autoupdate()
