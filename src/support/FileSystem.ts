import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';

const open = promisify(fs.open);
const close = promisify(fs.close);
const readFile = promisify(fs.readFile);

export default class FileSystem {
	public static getFileSize(path: string): number {
		const stats = fs.statSync(path);
		return stats.size;
	}

	public static exists(path: string): boolean {
		return fs.existsSync(path);
	}

	public static removeFile(path: string): void {
		fs.unlinkSync(path);
	}

	public static removeDirectory(path: string): void {
		fs.rmSync(path, { recursive: true, force: true });
	}

	public static createFile(path: string): void {
		fs.writeFileSync(path, '');
	}

	public static moveFile(source: string, destination: string): void {
		fs.renameSync(source, destination);
	}

	public static createDirectory(path: string): void {
		if (this.exists(path)) {
			return;
		}
		fs.mkdirSync(path, { recursive: true });
	}

	public static async readBytes(path: string, offset: number = 0, numBytes?: number): Promise<Buffer> {
		const length: number = !numBytes ? this.getFileSize(path) - offset : numBytes;
		return new Promise((resolve, reject
		) => {
			fs.open(path, 'r', (err, fd) => {
				if (err) {
					return reject(new Error(`Failed to open file: ${err.message}`));
				}

				const buffer = Buffer.alloc(length);

				fs.read(fd, buffer, 0, length, offset, (err, bytesRead, buffer) => {
					fs.close(fd, (closeErr) => {
						if (closeErr) {
							console.error(`Failed to close file: ${closeErr.message}`);
						}
					});

					if (err) {
						return reject(new Error(`Failed to read file: ${err.message}`));
					}
					resolve(buffer.subarray(0, bytesRead));
				});
			});
		}
		);
	}

	public static async joinFiles(files: string[], destination: string): Promise<void> {
		let destFileDescriptor: number | null = null;

		try {
			// Ensure the destination directory exists
			fs.mkdirSync(path.dirname(destination), { recursive: true });

			// Open the destination file for writing
			destFileDescriptor = await open(destination, 'w');

			for (const file of files) {
				if (!fs.existsSync(file)) {
					throw new Error(`File not found: ${file}`);
				}

				// Read file into a buffer
				const buffer = await readFile(file);

				// Write the buffer content to the destination file
				fs.writeSync(destFileDescriptor, buffer);
			}
		} finally {
			// Close the destination file descriptor if it was opened
			if (destFileDescriptor !== null) {
				await close(destFileDescriptor);
			}
		}
	}
}