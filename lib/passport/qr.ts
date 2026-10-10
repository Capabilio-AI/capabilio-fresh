import QRCode from "qrcode";

/** The passport QR as an SVG string (ink on white). Generated on the server from our own URL, so nothing user-supplied is rendered. */
export function passportQrSvg(url: string): Promise<string> {
  return QRCode.toString(url, { type: "svg", margin: 1, errorCorrectionLevel: "M", color: { dark: "#141414", light: "#ffffff" } });
}
