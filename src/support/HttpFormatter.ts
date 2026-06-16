/**
 * Formats a raw byte count into a human-readable size string (Bytes, KB, MB, ...).
 */
export default class HttpFormatter {

	private static readonly SIZES: string[] = ['Bytes', 'KB', 'MB', 'GB', 'TB'];

	public static formatBytes(bytes: number): string {
		if (bytes == 0) {
			return '0 Bytes';
		}
		const i: number = Math.floor(Math.log(bytes) / Math.log(1024));
		const value: string = (bytes / Math.pow(1024, i)).toFixed(2);
		return `${value} ${this.SIZES[i] ?? ''}`;
	}
}
