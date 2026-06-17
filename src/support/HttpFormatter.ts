/**
 * Formats a raw byte count into a human-readable size string (Bytes, KB, MB, ...).
 */
export default class HttpFormatter {

	private static readonly SIZES: string[] = ['Bytes', 'KB', 'MB', 'GB', 'TB'];

	public static formatBytes(bytes: number): string {
		if (bytes <= 0) {
			return '0 Bytes';
		}
		// Clamp the unit index to the last named size so values beyond TB keep a
		// unit suffix (e.g. petabytes render as "... TB") instead of an empty one.
		const exponent: number = Math.min(
			Math.floor(Math.log(bytes) / Math.log(1024)),
			this.SIZES.length - 1,
		);
		const value: string = (bytes / Math.pow(1024, exponent)).toFixed(2);
		return `${value} ${this.SIZES[exponent] ?? ''}`;
	}
}
