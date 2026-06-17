import { afterEach, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import FileSystem from '../../src/support/FileSystem.ts';

describe('FileSystem', () => {
	let tempDir: string;

	const filePath = (name: string): string => path.join(tempDir, name);

	beforeEach(() => {
		tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fs-test-'));
	});

	afterEach(() => {
		fs.rmSync(tempDir, { recursive: true, force: true });
	});

	it('reports the byte size of a file', () => {
		// Given a file of known length
		const file: string = filePath('size.txt');
		fs.writeFileSync(file, 'abcde');
		// When/Then its size is reported
		assert.equal(FileSystem.getFileSize(file), 5);
	});

	it('reports whether a path exists', () => {
		// Given a path that does not exist yet
		const file: string = filePath('here.txt');
		assert.equal(FileSystem.exists(file), false);
		// When the file is created
		fs.writeFileSync(file, '');
		// Then existence flips to true
		assert.equal(FileSystem.exists(file), true);
	});

	it('creates an empty file', () => {
		// Given a target path
		const file: string = filePath('new.txt');
		// When created
		FileSystem.createFile(file);
		// Then it exists and is empty
		assert.equal(FileSystem.exists(file), true);
		assert.equal(FileSystem.getFileSize(file), 0);
	});

	it('removes a file', () => {
		// Given an existing file
		const file: string = filePath('gone.txt');
		fs.writeFileSync(file, 'x');
		// When removed
		FileSystem.removeFile(file);
		// Then it is gone
		assert.equal(FileSystem.exists(file), false);
	});

	it('moves a file to a new path', () => {
		// Given a source file
		const source: string = filePath('src.txt');
		const destination: string = filePath('dest.txt');
		fs.writeFileSync(source, 'payload');
		// When moved
		FileSystem.moveFile(source, destination);
		// Then the source is gone and the destination holds the content
		assert.equal(FileSystem.exists(source), false);
		assert.equal(fs.readFileSync(destination, 'utf8'), 'payload');
	});

	it('removes a directory and its contents', () => {
		// Given a directory containing a file
		const dir: string = filePath('tree');
		fs.mkdirSync(dir);
		fs.writeFileSync(path.join(dir, 'f.txt'), 'x');
		// When removed recursively
		FileSystem.removeDirectory(dir);
		// Then the whole tree is gone
		assert.equal(fs.existsSync(dir), false);
	});

	describe('createDirectory', () => {
		it('creates a directory including missing parents', () => {
			// Given a nested path whose parents do not exist
			const dir: string = filePath('a/b/c');
			// When created
			FileSystem.createDirectory(dir);
			// Then the full chain exists
			assert.equal(fs.existsSync(dir), true);
		});

		it('is idempotent when the directory already exists', () => {
			// Given an already-created directory
			const dir: string = filePath('exists');
			FileSystem.createDirectory(dir);
			// When created again
			// Then it does not throw and still exists
			assert.doesNotThrow(() => FileSystem.createDirectory(dir));
			assert.equal(fs.existsSync(dir), true);
		});
	});

	describe('readBytes', () => {
		let file: string;

		beforeEach(() => {
			file = filePath('bytes.bin');
			fs.writeFileSync(file, 'ABCDEFGHIJ');
		});

		it('reads the whole file by default', async () => {
			// Given no offset or length
			const buffer: Buffer = await FileSystem.readBytes(file);
			// Then the entire content is returned
			assert.equal(buffer.toString(), 'ABCDEFGHIJ');
		});

		it('reads from an offset to the end', async () => {
			// Given an offset only
			const buffer: Buffer = await FileSystem.readBytes(file, 3);
			// Then it reads from the offset to EOF
			assert.equal(buffer.toString(), 'DEFGHIJ');
		});

		it('reads an explicit number of bytes from an offset', async () => {
			// Given an offset and an explicit length
			const buffer: Buffer = await FileSystem.readBytes(file, 2, 4);
			// Then exactly that slice is returned
			assert.equal(buffer.toString(), 'CDEF');
		});

		it('returns an empty buffer when an explicit length of 0 is given', async () => {
			// Given an explicit length of zero (a falsy value)
			const buffer: Buffer = await FileSystem.readBytes(file, 2, 0);
			// Then nothing is read, rather than falling back to a full read
			assert.equal(buffer.length, 0);
		});
	});

	describe('joinFiles', () => {
		it('concatenates source files in order', async () => {
			// Given three segment files
			const a: string = filePath('a');
			const b: string = filePath('b');
			const c: string = filePath('c');
			fs.writeFileSync(a, 'AAA');
			fs.writeFileSync(b, 'BB');
			fs.writeFileSync(c, 'C');
			const destination: string = filePath('joined.bin');
			// When joined
			await FileSystem.joinFiles([a, b, c], destination);
			// Then the destination is their in-order concatenation
			assert.equal(fs.readFileSync(destination, 'utf8'), 'AAABBC');
		});

		it('creates the destination directory if it is missing', async () => {
			// Given a destination inside a non-existent directory
			const a: string = filePath('a');
			fs.writeFileSync(a, 'data');
			const destination: string = filePath('nested/dir/out.bin');
			// When joined
			await FileSystem.joinFiles([a], destination);
			// Then the directory is created and the file written
			assert.equal(fs.readFileSync(destination, 'utf8'), 'data');
		});

		it('throws when a source file is missing', async () => {
			// Given one present and one missing source
			const a: string = filePath('a');
			fs.writeFileSync(a, 'data');
			const missing: string = filePath('nope');
			const destination: string = filePath('out.bin');
			// When joined
			// Then it rejects, naming the missing file (and the finally closes the fd)
			await assert.rejects(
				FileSystem.joinFiles([a, missing], destination),
				/File not found: .*nope/,
			);
		});
	});
});
