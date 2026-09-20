import { IngestionValidationSummary, BattingStats } from '../../src/types/index.ts';
import { baseballRepo } from '../repositories/baseball.repository.ts';

// Field Normalizer dictionary
const FIELD_MAP: Record<string, string> = {
  // Batting Average
  avg: 'avg',
  ba: 'avg',
  'batting average': 'avg',
  promedio: 'avg',
  ave: 'avg',

  // At Bats & Plate Appearances
  ab: 'ab',
  vb: 'ab',
  'veces al bate': 'ab',
  pa: 'pa',
  ap: 'pa',
  'apariciones al plato': 'pa',

  // Runs & Hits
  r: 'r',
  c: 'r',
  carreras: 'r',
  h: 'h',
  hits: 'h',
  imparables: 'h',

  // Extra base hits & RBI
  '2b': 'doubles',
  dobles: 'doubles',
  '3b': 'triples',
  triples: 'triples',
  hr: 'hr',
  jonrones: 'hr',
  cuadrangulares: 'hr',
  vuelacercas: 'hr',
  rbi: 'rbi',
  ci: 'rbi',
  impulsadas: 'rbi',
  remolcadas: 'rbi',

  // Walks & Strikeouts
  bb: 'bb',
  boletos: 'bb',
  bases: 'bb',
  so: 'so',
  k: 'so',
  ponches: 'so',

  // Stolen bases
  sb: 'sb',
  br: 'sb',
  robos: 'sb',

  // Percentages & Sabermetrics
  obp: 'obp',
  slg: 'slg',
  ops: 'ops',
  war: 'war',
  woba: 'woba',

  // Player & Team metadata
  player: 'playerName',
  jugador: 'playerName',
  nombre: 'playerName',
  team: 'teamShort',
  equipo: 'teamShort',
  pos: 'position',
  posicion: 'position',
};

export class IngestionService {
  /**
   * Parses raw CSV or JSON text, normalizes keys, applies business validations
   * and yields a rich audit summary.
   */
  static processData(
    rawText: string,
    format: 'csv' | 'json'
  ): IngestionValidationSummary {
    let rows: Record<string, any>[] = [];

    if (format === 'json') {
      try {
        const parsed = JSON.parse(rawText);
        rows = Array.isArray(parsed) ? parsed : [parsed];
      } catch (err: any) {
        return {
          totalRecords: 0,
          validRecords: 0,
          warnings: [],
          errors: [{ row: 0, field: 'JSON', message: `Error sintáctico JSON: ${err.message}` }],
          preview: [],
        };
      }
    } else {
      // CSV parser
      const lines = rawText
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l.length > 0);

      if (lines.length < 2) {
        return {
          totalRecords: 0,
          validRecords: 0,
          warnings: [],
          errors: [{ row: 0, field: 'CSV', message: 'El archivo CSV debe contener cabecera y al menos un registro' }],
          preview: [],
        };
      }

      const headers = lines[0]
        .split(',')
        .map((h) => h.trim().replace(/^["']|["']$/g, '').toLowerCase());

      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map((v) => v.trim().replace(/^["']|["']$/g, ''));
        const rowObj: Record<string, any> = {};
        headers.forEach((hdr, idx) => {
          rowObj[hdr] = values[idx] !== undefined ? values[idx] : '';
        });
        rows.push(rowObj);
      }
    }

    const totalRecords = rows.length;
    const warnings: Array<{ row: number; field: string; message: string }> = [];
    const errors: Array<{ row: number; field: string; message: string }> = [];
    const validRows: BattingStats[] = [];

    rows.forEach((rawRow, index) => {
      const rowNumber = index + 1;
      const normalized: Record<string, any> = {};

      // 1. Normalizar nombres de columnas
      for (const [key, val] of Object.entries(rawRow)) {
        const cleanKey = key.trim().toLowerCase();
        const mappedKey = FIELD_MAP[cleanKey] || cleanKey;
        normalized[mappedKey] = val;
      }

      // 2. Validar campos indispensables
      const playerName = normalized.playerName || normalized.player || normalized.nombre;
      if (!playerName || String(playerName).trim().length === 0) {
        errors.push({ row: rowNumber, field: 'player', message: 'El nombre del jugador es obligatorio' });
        return;
      }

      const teamShort = (normalized.teamShort || normalized.team || normalized.equipo || 'DES').toUpperCase();
      const ab = parseInt(normalized.ab ?? '0', 10);
      const h = parseInt(normalized.h ?? '0', 10);
      const hr = parseInt(normalized.hr ?? '0', 10);
      const rbi = parseInt(normalized.rbi ?? '0', 10);
      const bb = parseInt(normalized.bb ?? '0', 10);
      const so = parseInt(normalized.so ?? '0', 10);
      const r = parseInt(normalized.r ?? '0', 10);
      const doubles = parseInt(normalized.doubles ?? '0', 10);
      const triples = parseInt(normalized.triples ?? '0', 10);

      // 3. Validaciones de consistencia de béisbol
      if (isNaN(ab) || ab < 0) {
        errors.push({ row: rowNumber, field: 'AB', message: 'Veces al bate debe ser un número entero >= 0' });
        return;
      }

      if (isNaN(h) || h < 0) {
        errors.push({ row: rowNumber, field: 'H', message: 'Hits debe ser un número entero >= 0' });
        return;
      }

      if (h > ab && ab > 0) {
        errors.push({ row: rowNumber, field: 'H', message: `Hits (${h}) no pueden superar las veces al bate (${ab})` });
        return;
      }

      // Calcular promedio si no vino provisto o advertir si difiere
      let avg = parseFloat(normalized.avg);
      if (isNaN(avg)) {
        avg = ab > 0 ? Math.round((h / ab) * 1000) / 1000 : 0.0;
        warnings.push({
          row: rowNumber,
          field: 'AVG',
          message: `Promedio no provisto; calculado automáticamente (${avg.toFixed(3)}) a partir de H y AB`,
        });
      } else if (ab > 0) {
        const expectedAvg = Math.round((h / ab) * 1000) / 1000;
        if (Math.abs(avg - expectedAvg) > 0.005) {
          warnings.push({
            row: rowNumber,
            field: 'AVG',
            message: `Discrepancia estadística: AVG provisto (${avg}) difiere del cálculo H/AB (${expectedAvg})`,
          });
        }
      }

      // SLG y OBP aproximados si no vienen
      let obp = parseFloat(normalized.obp);
      if (isNaN(obp)) {
        obp = ab + bb > 0 ? Math.round(((h + bb) / (ab + bb)) * 1000) / 1000 : avg;
      }

      let slg = parseFloat(normalized.slg);
      if (isNaN(slg)) {
        const singles = Math.max(0, h - (doubles + triples + hr));
        const tb = singles + doubles * 2 + triples * 3 + hr * 4;
        slg = ab > 0 ? Math.round((tb / ab) * 1000) / 1000 : avg;
      }

      const ops = Math.round((obp + slg) * 1000) / 1000;

      const record: BattingStats = {
        id: `ingest-${Date.now()}-${rowNumber}`,
        playerId: `p-ingested-${rowNumber}`,
        playerName: String(playerName).trim(),
        teamId: teamShort.toLowerCase(),
        teamShort,
        position: normalized.position || 'OF',
        seasonYear: 2026,
        games: parseInt(normalized.games ?? '15', 10),
        pa: ab + bb,
        ab,
        r,
        h,
        doubles,
        triples,
        hr,
        rbi,
        bb,
        so,
        sb: parseInt(normalized.sb ?? '0', 10),
        cs: parseInt(normalized.cs ?? '0', 10),
        avg,
        obp,
        slg,
        ops,
        war: normalized.war ? parseFloat(normalized.war) : 1.0,
      };

      validRows.push(record);
    });

    return {
      totalRecords,
      validRecords: validRows.length,
      warnings,
      errors,
      preview: validRows.slice(0, 10),
    };
  }

  static commitIngestion(records: BattingStats[]): number {
    return baseballRepo.insertBattingStatsBatch(records);
  }
}
