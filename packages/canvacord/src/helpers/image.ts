import type { ResvgRenderOptions } from "@resvg/resvg-js";
import { EncodingFormat } from "../canvas/Encodable";
import { AvifConfig, PngEncodeOptions, Transformer } from "@napi-rs/image";
import { getResvg, getSharp } from "./decoder";

/**
 * The options for rendering the svg.
 */
export type RenderSvgOptions = PngEncodeOptions | AvifConfig | number | null;

/**
 * Renders the svg to the specified format.
 * @param svg The svg `string` or `Buffer` to render
 * @param format The format to render to
 * @param [options] The options for rendering
 * @param [signal] The abort signal
 */
export async function renderSvg({
  svg,
  format,
  options,
  signal,
}: {
  svg: string | Buffer;
  format: EncodingFormat;
  options?: RenderSvgOptions;
  signal?: AbortSignal | null;
}): Promise<Buffer> {
  const opts: ResvgRenderOptions = {
    font: {
      loadSystemFonts: false,
    },
    logLevel: "off",
  };

  const sharp = await getSharp();

  if (sharp) {
    const input = Buffer.isBuffer(svg) ? svg : Buffer.from(svg);
    const img = sharp(input)
      .toFormat(format, {
        quality: 100,
      })
      .toBuffer();

    return img;
  }

  const renderAsync = await getResvg();

  if (!renderAsync) {
    throw new Error("Could not load @resvg/resvg-js package");
  }

  const output = await renderAsync(svg, opts);

  if (format === "raw") {
    return output.pixels;
  }

  if (format === "png") {
    return output.asPng();
  }

  const transformer = Transformer.fromRgbaPixels(output.pixels, output.width, output.height);

  options ??= null;
  signal ??= null;

  switch (format) {
    case "avif":
      return transformer.avif(options as AvifConfig, signal);
    case "jpeg":
      return transformer.jpeg(options as number, signal);
    case "webp":
      return transformer.webp(options as number, signal);
    default:
      throw new TypeError(`Unsupported encoding format: "${format}"`);
  }
}

const createSvgBase64 = (svg: string | Buffer) =>
  `data:image/svg+xml;base64,${Buffer.isBuffer(svg) ? svg.toString("base64") : Buffer.from(svg).toString("base64")}`;

export class CanvacordImage {
  public constructor(
    public data: Buffer,
    public mime: string,
  ) {}

  public toBase64() {
    return this.data.toString("base64");
  }

  public toDataURL() {
    return `data:${this.mime};base64,${this.toBase64()}`;
  }
}
