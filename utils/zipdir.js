const fs = require('fs')
const archiver = require('archiver')

module.exports = async (src, dst, root) => new Promise((resolve, reject) => {
	const output = fs.createWriteStream(dst)
	const archive = archiver('zip')

	output.on('close', function() {
		console.log(archive.pointer() + ' total bytes')
		console.log('archiver has been finalized and the output file descriptor has closed.')
		resolve()
	})

	archive.on('error', function(err) {
		reject(err)
	})

	archive.pipe(output)
	archive.directory(src, root)
	archive.finalize()
})
