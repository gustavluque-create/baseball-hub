import { IngestionValidationSummary, BattingStats } from '../../src/types/index.ts';
import { baseballRepo } from '../repositories/baseball.repository.ts';

// Field Normalizer dictionary
const FIELD_MAP: Record<string, string> = {
  // Player name variants
  player: 'playerName',
  playername: 'playerName',
  fullname: 'playerName',
  name: 'playerName',
  nombre: 'playerName',
  jugador: 'playerName',
  atleta: 'playerName',
  nombrecompleto: 'playerName',
  pitcher: 'playerName',
  bateador: 'playerName',

  // Team metadata variants
  team: 'teamShort',
  teamshort: 'teamShort',
  teamname: 'teamShort',
  teamid: 'teamId',
  equipo: 'teamShort',
  siglas: 'teamShort',
  abreviatura: 'teamShort',

  // Position variants
  pos: 'position',
  position: 'position',
  posicion: 'position',

  // Jersey / Number
  jersey: 'jerseyNumber',
  jerseynumber: 'jerseyNumber',
  numero: 'jerseyNumber',
  number: 'jerseyNumber',
  dorsal: 'jerseyNumber',

  // Batting Average
  avg: 'avg',
  ba: 'avg',
  battingaverage: 'avg',
  'batting average': 'avg',
  promedio: 'avg',
  ave: 'avg',

  // At Bats & Plate Appearances
  ab: 'ab',
  atbats: 'ab',
  vb: 'ab',
  vecesalbate: 'ab',
  'veces al bate': 'ab',
  pa: 'pa',
  plateappearances: 'pa',
  ap: 'pa',
  apariciones: 'pa',
  'apariciones al plato': 'pa',
  aparicionesalplato: 'pa',

  // Runs & Hits
  r: 'r',
  runs: 'r',
  c: 'r',
  ca: 'r',
  carreras: 'r',
  carrerasanotadas: 'r',
  h: 'h',
  hits: 'h',
  imparables: 'h',
  incohits: 'h',

  // Extra base hits & RBI
  '2b': 'doubles',
  doubles: 'doubles',
  dobles: 'doubles',
  tubeyes: 'doubles',
  '3b': 'triples',
  triples: 'triples',
  hr: 'hr',
  homers: 'hr',
  homeruns: 'hr',
  jonrones: 'hr',
  cuadrangulares: 'hr',
  vuelacercas: 'hr',
  rbi: 'rbi',
  ci: 'rbi',
  impulsadas: 'rbi',
  remolcadas: 'rbi',
  carrerasimpulsadas: 'rbi',

  // Walks & Strikeouts
  bb: 'bb',
  walks: 'bb',
  boletos: 'bb',
  bases: 'bb',
  basesporbolas: 'bb',
  so: 'so',
  k: 'so',
  ponches: 'so',
  strikeouts: 'so',

  // Stolen bases
  sb: 'sb',
  stolenbases: 'sb',
  br: 'sb',
  robos: 'sb',
  basesrobadas: 'sb',
  cs: 'cs',
  caughtstealing: 'cs',
  atrapadorobando: 'cs',

  // Percentages & Sabermetrics
  obp: 'obp',
  onbasepercentage: 'obp',
  slg: 'slg',
  slugging: 'slg',
  ops: 'ops',
  war: 'war',
  woba: 'woba',

  // Pitching fields
  era: 'era',
  pcl: 'era',
  efectividad: 'era',
  ip: 'ip',
  inn: 'ip',
  innings: 'ip',
  entradas: 'ip',
  el: 'ip',
  w: 'w',
  wins: 'w',
  ganados: 'w',
  jg: 'w',
  l: 'l',
  losses: 'l',
  perdidos: 'l',
  jp: 'l',
  sv: 'sv',
  saves: 'sv',
  salvados: 'sv',
  js: 'sv',
  whip: 'whip',
  er: 'er',
  cl: 'er',
  carreraslimpias: 'er',
  cg: 'cg',
  completos: 'cg',
  sho: 'sho',
  lechadas: 'sho',
  gs: 'gs',
  iniciados: 'gs',
  ji: 'gs',

  // Profile fields
  photo: 'photo',
  foto: 'photo',
  image: 'photo',
  imageurl: 'photo',
  fotourl: 'photo',
  bio: 'bio',
  biografia: 'bio',
  age: 'age',
  edad: 'age',
  bats: 'bats',
  batea: 'bats',
  throws: 'throws',
  lanza: 'throws',
  games: 'games',
  juegos: 'games',
  jj: 'games',
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
        if (Array.isArray(parsed)) {
          rows = parsed;
        } else if (parsed && typeof parsed === 'object') {
          rows = parsed.players || parsed.data || parsed.items || parsed.records || [parsed];
        } else {
          rows = [parsed];
        }
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

    const allTeams = baseballRepo.getTeams();

    rows.forEach((rawRow, index) => {
      const rowNumber = index + 1;
      if (!rawRow || typeof rawRow !== 'object') {
        errors.push({ row: rowNumber, field: 'row', message: 'Fila con estructura inválida' });
        return;
      }

      const normalized: Record<string, any> = {};

      // 1. Normalizar nombres de columnas
      for (const [key, val] of Object.entries(rawRow)) {
        const lowerKey = key.trim().toLowerCase();
        const cleanKey = lowerKey.replace(/[-_\s]/g, '');
        const mappedKey = FIELD_MAP[cleanKey] || FIELD_MAP[lowerKey] || cleanKey;
        normalized[mappedKey] = val;
        // Preservar también clave en minúsculas directa
        normalized[lowerKey] = val;
      }

      // 2. Validar nombre obligatorio de jugador
      const playerName =
        normalized.playerName ??
        normalized.player ??
        normalized.playername ??
        normalized.fullname ??
        normalized.fullName ??
        normalized.name ??
        normalized.nombre ??
        normalized.jugador ??
        rawRow.playerName ??
        rawRow.fullName ??
        rawRow.name ??
        rawRow.nombre ??
        rawRow.player ??
        rawRow.jugador;

      if (!playerName || String(playerName).trim().length === 0) {
        errors.push({ row: rowNumber, field: 'player', message: 'El nombre del jugador es obligatorio' });
        return;
      }

      // 3. Normalizar equipo
      const rawTeam = String(
        normalized.teamShort ??
        normalized.team ??
        normalized.teamshort ??
        normalized.equipo ??
        normalized.teamId ??
        rawRow.teamShort ??
        rawRow.team ??
        rawRow.equipo ??
        rawRow.teamId ??
        'PRI'
      ).trim();

      const matchedTeam = allTeams.find(
        (t) =>
          t.shortName.toLowerCase() === rawTeam.toLowerCase() ||
          t.id.toLowerCase() === rawTeam.toLowerCase() ||
          t.name.toLowerCase() === rawTeam.toLowerCase() ||
          t.name.toLowerCase().includes(rawTeam.toLowerCase())
      );

      const teamShort = matchedTeam ? matchedTeam.shortName : rawTeam.toUpperCase();
      const teamId = matchedTeam ? matchedTeam.id : `team-${teamShort.toLowerCase()}`;

      // 4. Normalizar posición
      let position = String(
        normalized.position ??
        normalized.pos ??
        normalized.posicion ??
        rawRow.position ??
        rawRow.pos ??
        rawRow.posicion ??
        'OF'
      ).trim().toUpperCase();

      if (position === 'LANZADOR' || position === 'PITCHER') position = 'P';
      if (position === 'RECEPTOR' || position === 'CATCHER') position = 'C';
      if (position === 'PRIMERA' || position === '1B') position = '1B';
      if (position === 'SEGUNDA' || position === '2B') position = '2B';
      if (position === 'TERCERA' || position === '3B') position = '3B';
      if (position === 'CAMPOCORTO' || position === 'TORPEDERO' || position === 'SIOR' || position === 'SS') position = 'SS';
      if (position === 'JARDINERO' || position === 'OUTFIELD') position = 'OF';
      if (position === 'DESIGNADO' || position === 'BD') position = 'DH';

      // 5. Estadísticas ofensivas
      const abRaw = normalized.ab ?? rawRow.ab;
      const hRaw = normalized.h ?? rawRow.h;
      const ab = abRaw !== undefined && abRaw !== null && abRaw !== '' ? parseInt(String(abRaw), 10) : 0;
      const h = hRaw !== undefined && hRaw !== null && hRaw !== '' ? parseInt(String(hRaw), 10) : 0;
      const hr = parseInt(String(normalized.hr ?? rawRow.hr ?? '0'), 10) || 0;
      const rbi = parseInt(String(normalized.rbi ?? rawRow.rbi ?? '0'), 10) || 0;
      const bb = parseInt(String(normalized.bb ?? rawRow.bb ?? '0'), 10) || 0;
      const so = parseInt(String(normalized.so ?? rawRow.so ?? '0'), 10) || 0;
      const r = parseInt(String(normalized.r ?? rawRow.r ?? '0'), 10) || 0;
      const doubles = parseInt(String(normalized.doubles ?? rawRow.doubles ?? '0'), 10) || 0;
      const triples = parseInt(String(normalized.triples ?? rawRow.triples ?? '0'), 10) || 0;

      // Validaciones de consistencia
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

      // Calcular promedio si no vino provisto
      let avg = parseFloat(String(normalized.avg ?? rawRow.avg ?? ''));
      if (isNaN(avg)) {
        avg = ab > 0 ? Math.round((h / ab) * 1000) / 1000 : 0.0;
        if (ab > 0) {
          warnings.push({
            row: rowNumber,
            field: 'AVG',
            message: `Promedio no provisto; calculado automáticamente (${avg.toFixed(3)}) a partir de H y AB`,
          });
        }
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
      let obp = parseFloat(String(normalized.obp ?? rawRow.obp ?? ''));
      if (isNaN(obp)) {
        obp = ab + bb > 0 ? Math.round(((h + bb) / (ab + bb)) * 1000) / 1000 : avg;
      }

      let slg = parseFloat(String(normalized.slg ?? rawRow.slg ?? ''));
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
        teamId,
        teamShort,
        position: position as any,
        seasonYear: 2026,
        games: parseInt(String(normalized.games ?? rawRow.games ?? '15'), 10) || 15,
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
        sb: parseInt(String(normalized.sb ?? rawRow.sb ?? '0'), 10) || 0,
        cs: parseInt(String(normalized.cs ?? rawRow.cs ?? '0'), 10) || 0,
        avg,
        obp,
        slg,
        ops,
        war: normalized.war ? parseFloat(String(normalized.war)) : 1.0,
      };

      // Conservar metadatos opcionales del jugador para el commit en el repo
      (record as any).jerseyNumber = parseInt(String(normalized.jerseyNumber ?? rawRow.jerseyNumber ?? rawRow.jersey ?? rawRow.numero ?? rawRow.dorsal ?? '0'), 10) || undefined;
      (record as any).bats = (normalized.bats ?? rawRow.bats ?? rawRow.batea ?? 'R').toString().toUpperCase().trim();
      (record as any).throws = (normalized.throws ?? rawRow.throws ?? rawRow.lanza ?? 'R').toString().toUpperCase().trim();
      (record as any).photo = normalized.photo ?? rawRow.photo ?? rawRow.foto ?? rawRow.imageUrl;
      (record as any).bio = normalized.bio ?? rawRow.bio ?? rawRow.biografia;
      (record as any).age = parseInt(String(normalized.age ?? rawRow.age ?? rawRow.edad ?? '26'), 10) || 26;

      // Conservar métricas de pitcheo si es lanzador
      if (position === 'P' || normalized.era !== undefined || rawRow.era !== undefined || normalized.ip !== undefined || rawRow.ip !== undefined) {
        (record as any).era = parseFloat(String(normalized.era ?? rawRow.era ?? '3.50')) || 3.50;
        (record as any).ip = parseFloat(String(normalized.ip ?? rawRow.ip ?? '25.0')) || 25.0;
        (record as any).w = parseInt(String(normalized.w ?? rawRow.w ?? rawRow.wins ?? '2'), 10) || 2;
        (record as any).l = parseInt(String(normalized.l ?? rawRow.l ?? rawRow.losses ?? '1'), 10) || 1;
        (record as any).sv = parseInt(String(normalized.sv ?? rawRow.sv ?? rawRow.saves ?? '0'), 10) || 0;
      }

      validRows.push(record);
    });

    return {
      totalRecords,
      validRecords: validRows.length,
      warnings,
      errors,
      preview: validRows.slice(0, 10),
      records: validRows,
    };
  }

  static commitIngestion(records: BattingStats[]): number {
    return baseballRepo.insertBattingStatsBatch(records);
  }
}
