#!/usr/bin/env node
// Server-side CLI. The reason this exists: a host in any language —
// Java, Python, Go, a shell script — can render an xl3 template without
// embedding a JS runtime in its own process and without first
// materializing its rows into a `data.xlsx`. It pipes
// `xl3-source-json/0.1` (ADR-0075) in on stdin and gets `.xlsx` files
// out.
//
// Flag style (`--name=value`, no space-separated form) matches
// `bin/conformance.ts` so the two CLIs behave the same way.
//
// Exit codes, so a calling process can branch without parsing text:
//   0  success
//   1  conversion failed (an `xl3/...` error, or an I/O failure)
//   2  usage error (bad flags, missing file)

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { basename, isAbsolute, resolve } from 'node:path';
import { createRequire } from 'node:module';
import {
  convert,
  convertJson,
  packageZip,
  preview,
  previewJson,
  readTemplateInputs,
} from '../index.js';
import { isXtlError } from '../error-codes.js';
import type { ConvertOptions, OutputFile } from '../types.js';

type Command = 'render' | 'preview' | 'inputs';
type Engine = NonNullable<ConvertOptions['engine']>;

interface Cli {
  command: Command;
  template: string;
  /** Path to the source, or `-` for JSON on stdin. Unused by `inputs`. */
  data?: string;
  out: string;
  zip?: string;
  inputs: Record<string, unknown>;
  engine: Engine;
  json: boolean;
  quiet: boolean;
}

const USAGE = [
  'usage: xl3 render  <template.xlsx> --data=<source.json|source.xlsx|-> [options]',
  '       xl3 preview <template.xlsx> --data=<source.json|source.xlsx|-> [options]',
  '       xl3 inputs  <template.xlsx>',
  '',
  'options:',
  '  --data=<path|->     Source data. `.json` is read as xl3-source-json/0.1,',
  '                      `.xlsx` as a data workbook, `-` as JSON on stdin.',
  '  --out=<dir>         Directory to write output files into (default: .).',
  '  --zip=<file>        Write one zip instead of loose files.',
  '  --input=<k=v>       Value for a template runtime input. Repeatable.',
  '  --inputs=<path|->   Same, as a JSON object. Merged under --input.',
  '  --engine=auto|wasm|js   Render engine (default: auto). JSON sources are',
  '                      JS-only; --engine=wasm with JSON input is an error.',
  '  --json              Emit a machine-readable result on stdout.',
  '  --quiet             Suppress the human summary on stderr.',
  '  --version           Print the package version.',
].join('\n');

function die(msg: string): never {
  console.error(`xl3: ${msg}`);
  console.error(USAGE);
  process.exit(2);
}

function packageVersion(): string {
  // dist/bin/xl3.js → dist/bin/../../package.json is this package's own
  // manifest, both in the build output and when run from src in tests.
  const req = createRequire(import.meta.url);
  const pkg = req('../../package.json') as { version?: string };
  return pkg.version ?? 'unknown';
}

function parseArgs(argv: string[]): Cli {
  const args = argv.slice(2);
  if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
    console.error(USAGE);
    process.exit(args.length === 0 ? 2 : 0);
  }
  if (args[0] === '--version' || args[0] === '-v') {
    process.stdout.write(packageVersion() + '\n');
    process.exit(0);
  }

  const command = args[0];
  if (command !== 'render' && command !== 'preview' && command !== 'inputs') {
    die(`unknown command: ${command}`);
  }

  const cli: Cli = {
    command,
    template: '',
    out: '.',
    inputs: {},
    engine: 'auto',
    json: false,
    quiet: false,
  };
  const inputPairs: [string, string][] = [];
  let inputsFile: string | undefined;

  for (const arg of args.slice(1)) {
    if (!arg.startsWith('--')) {
      if (cli.template) die(`unexpected argument: ${arg}`);
      cli.template = arg;
      continue;
    }
    const eq = arg.indexOf('=');
    const name = eq < 0 ? arg.slice(2) : arg.slice(2, eq);
    const value = eq < 0 ? '' : arg.slice(eq + 1);
    switch (name) {
      case 'data': cli.data = value; break;
      case 'out': cli.out = value; break;
      case 'zip': cli.zip = value; break;
      case 'inputs': inputsFile = value; break;
      case 'input': {
        const sep = value.indexOf('=');
        if (sep <= 0) die(`--input expects name=value (got "${value}")`);
        inputPairs.push([value.slice(0, sep), value.slice(sep + 1)]);
        break;
      }
      case 'engine':
        if (value !== 'auto' && value !== 'wasm' && value !== 'js') {
          die(`--engine expects auto|wasm|js (got "${value}")`);
        }
        cli.engine = value;
        break;
      case 'json': cli.json = true; break;
      case 'quiet': cli.quiet = true; break;
      default: die(`unrecognized option: --${name}`);
    }
  }

  if (!cli.template) die('missing <template.xlsx>');
  if (cli.command !== 'inputs' && !cli.data) die('missing --data');
  if (cli.zip && cli.command !== 'render') die('--zip applies to `render` only');

  // Deferred so the JSON file is read once, after arg validation.
  (cli as Cli & { inputsFile?: string }).inputsFile = inputsFile;
  (cli as Cli & { inputPairs?: [string, string][] }).inputPairs = inputPairs;
  return cli;
}

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString('utf8');
}

function toArrayBuffer(buf: Buffer): ArrayBuffer {
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
}

async function resolveInputs(cli: Cli): Promise<Record<string, unknown>> {
  const withExtras = cli as Cli & { inputsFile?: string; inputPairs?: [string, string][] };
  const merged: Record<string, unknown> = {};

  if (withExtras.inputsFile) {
    const raw = withExtras.inputsFile === '-'
      ? await readStdin()
      : await readFile(resolve(withExtras.inputsFile), 'utf8');
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch (e) {
      die(`--inputs is not valid JSON: ${(e as Error).message}`);
    }
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
      die('--inputs must be a JSON object');
    }
    Object.assign(merged, parsed);
  }

  // `--input=k=v` wins over the file, so a scripted run can override one
  // value without rewriting the JSON.
  for (const [k, v] of withExtras.inputPairs ?? []) merged[k] = v;
  return merged;
}

/** True when the source should be read as `xl3-source-json/0.1`. */
function isJsonSource(data: string): boolean {
  return data === '-' || data.toLowerCase().endsWith('.json');
}

/**
 * Output filenames come from the template's `output_file_pattern` and are
 * already sanitized (ADR-0002). This is defense in depth for the one thing
 * the library never has to care about and a CLI does: those names become
 * real paths. A name that tries to escape `--out` is a hard stop, not a
 * silent `basename()` rewrite — quietly writing to a different file than
 * the template asked for is worse than refusing.
 */
function safeOutputName(filename: string): string {
  const unsafe =
    isAbsolute(filename) ||
    filename.includes('/') ||
    filename.includes('\\') ||
    filename.split(/[/\\]/).includes('..') ||
    basename(filename) !== filename;
  if (unsafe) {
    console.error(`xl3: refusing to write output filename outside --out: ${filename}`);
    process.exit(1);
  }
  return filename;
}

async function writeOutputs(files: OutputFile[], cli: Cli): Promise<string[]> {
  if (cli.zip) {
    const blob = await packageZip(files);
    const target = resolve(cli.zip);
    await writeFile(target, Buffer.from(await blob.arrayBuffer()));
    return [target];
  }
  const dir = resolve(cli.out);
  await mkdir(dir, { recursive: true });
  const written: string[] = [];
  for (const f of files) {
    const target = resolve(dir, safeOutputName(f.filename));
    await writeFile(target, Buffer.from(f.data));
    written.push(target);
  }
  return written;
}

async function main(): Promise<number> {
  const cli = parseArgs(process.argv);
  const templateBuffer = toArrayBuffer(await readFile(resolve(cli.template)));

  if (cli.command === 'inputs') {
    const specs = await readTemplateInputs(templateBuffer);
    process.stdout.write(JSON.stringify(specs, null, 2) + '\n');
    return 0;
  }

  const data = cli.data as string;
  const options: ConvertOptions = {
    inputs: await resolveInputs(cli),
    engine: cli.engine,
  };

  if (cli.command === 'preview') {
    const result = isJsonSource(data)
      ? await previewJson(
          templateBuffer,
          data === '-' ? await readStdin() : await readFile(resolve(data), 'utf8'),
          options,
        )
      : await preview(templateBuffer, toArrayBuffer(await readFile(resolve(data))), options);
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
    return 0;
  }

  const files = isJsonSource(data)
    ? await convertJson(
        templateBuffer,
        data === '-' ? await readStdin() : await readFile(resolve(data), 'utf8'),
        options,
      )
    : await convert(templateBuffer, toArrayBuffer(await readFile(resolve(data))), options);

  const written = await writeOutputs(files, cli);
  const warnings = files.flatMap((f) => f.warnings.map((w) => ({ file: f.filename, ...w })));

  if (cli.json) {
    process.stdout.write(
      JSON.stringify({ files: written, count: files.length, warnings }, null, 2) + '\n',
    );
  } else if (!cli.quiet) {
    // Summary goes to stderr so `--json`-less runs can still be piped
    // without the report contaminating stdout.
    for (const w of warnings) console.error(`xl3: warning: ${w.file}: ${w.message}`);
    console.error(`xl3: wrote ${written.length} file(s)`);
    for (const w of written) console.error(`  ${w}`);
  }
  return 0;
}

try {
  process.exit(await main());
} catch (e) {
  if (isXtlError(e)) {
    // ADR-0015: `code` is the stable contract a host dispatches on, so it
    // leads the line and is a machine-readable field under --json.
    if (process.argv.includes('--json')) {
      process.stderr.write(
        JSON.stringify({ error: { code: e.code, message: e.message } }, null, 2) + '\n',
      );
    } else {
      console.error(`xl3: ${e.code}: ${e.message}`);
    }
  } else {
    console.error(`xl3: ${(e as Error).message ?? String(e)}`);
  }
  process.exit(1);
}
