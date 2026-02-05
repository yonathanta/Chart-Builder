<script setup lang="ts">
import { reactive, watch, onBeforeUnmount } from "vue";
import * as XLSX from 'xlsx';
import type { DataBinding } from "../specs/chartSpec";

const props = defineProps<{
  binding: DataBinding;
}>();

const emit = defineEmits<{
  (e: "update:binding", payload: DataBinding): void;
  (e: "update:encoding", payload: { category: string; value: string; series?: string }): void;
  (e: "update:years", payload: string[]): void;
  (e: "navigate:config"): void;
  (e: "preview-refresh"): void;
}>();

const local = reactive<DataBinding>({
  ...props.binding,
  query: { ...props.binding.query },
});

let fileObjectUrl: string | null = null;
const schemaFields = reactive<{ keys: string[] }>({ keys: [] });
const mapping = reactive<{ category?: string; value?: string; series?: string; years: string[] }>({ years: [] });
let uploadedRows: any[] = [];

let syncingFromProps = false;

watch(
  () => props.binding,
  (next) => {
    syncingFromProps = true;
    Object.assign(local, next, { query: { ...next.query } });
    syncingFromProps = false;
  },
  { deep: true }
);

watch(
  () => ({ ...local, query: { ...local.query } }),
  (next, prev) => {
    if (syncingFromProps) return;
    const same = JSON.stringify(next) === JSON.stringify(prev);
    if (!same) emit("update:binding", next as DataBinding);
  },
  { deep: true }
);

const providerOptions: Array<{ label: string; value: DataBinding["provider"]; kind: DataBinding["kind"] }>
  = [
    { label: "JSON (static/HTTP)", value: "json", kind: "json" },
    { label: "HTTP API", value: "http", kind: "http" },
    { label: "Database", value: "db", kind: "db" },
  ];

async function handleFileUpload(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;

  try {
    let parsedRows: any[] = [];

    const name = file.name.toLowerCase();
    if (name.endsWith('.json') || file.type === 'application/json') {
      const text = await file.text();
      const parsed = JSON.parse(text);
      parsedRows = Array.isArray(parsed) ? parsed : (Array.isArray(parsed?.data) ? parsed.data : []);
    } else {
      // use xlsx to read CSV/Excel/TSV
      const ab = await file.arrayBuffer();
      const wb = XLSX.read(ab, { type: 'array' });
      const first = wb.SheetNames[0];
      const sheet = wb.Sheets[first];
      parsedRows = XLSX.utils.sheet_to_json(sheet, { defval: '' }) as any[];
    }

    uploadedRows = parsedRows;
    const first = uploadedRows[0] || {};
    const keys = Object.keys(first);
    schemaFields.keys = keys;
    // naive defaults
    mapping.category = keys.find(k => /cat|name|label/i.test(k)) || keys[0];
    mapping.value = keys.find(k => /val|count|total|pop|population|amount|metric/i.test(k)) || keys[1];
    mapping.series = keys.find(k => /year|date|month|time|series/i.test(k));
    // derive years
    if (mapping.series) {
      const uniq = Array.from(new Set(uploadedRows.map(r => String(r[mapping.series!]))).values());
      mapping.years = uniq.slice(0, Math.min(uniq.length, 5));
      emit("update:years", mapping.years);
    } else {
      mapping.years = [];
      emit("update:years", []);
    }

    // create a JSON blob URL for the preview to consume
    const textJson = JSON.stringify(uploadedRows);
    if (fileObjectUrl) URL.revokeObjectURL(fileObjectUrl);
    fileObjectUrl = URL.createObjectURL(new Blob([textJson], { type: "application/json" }));

    local.provider = "json";
    local.kind = "json";
    local.query.source = fileObjectUrl;
    local.query.params = undefined;

    // Emit an initial encoding guess
    if (mapping.category && mapping.value) {
      emit("update:encoding", { category: mapping.category, value: mapping.value, series: mapping.series });
    }
    emit("navigate:config");
    // Ask the preview to reload immediately after upload so users see the data
    emit("preview-refresh");
  } catch (err) {
    alert("Failed to parse file. Please upload a valid JSON, CSV, or Excel file.");
    console.error(err);
  } finally {
    // clear input so the same file can be re-uploaded if needed
    if (input) input.value = '';
  }
}

function triggerDownload(content: BlobPart, filename: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function downloadJsonTemplate() {
  const template = [
    { category: "Alpha", value: 120, series: "2024" },
    { category: "Beta", value: 90, series: "2024" },
    { category: "Alpha", value: 140, series: "2025" }
  ];
  triggerDownload(JSON.stringify(template, null, 2), "chart-template.json", "application/json");
}

function downloadExcelTemplate() {
  const header = "category,value,series\n";
  const rows = [
    "Alpha,120,2024",
    "Beta,90,2024",
    "Alpha,140,2025"
  ].join("\n");
  const csv = `${header}${rows}`;
  triggerDownload(csv, "chart-template.csv", "text/csv");
}

// Keep the blob URL alive while the preview may still need it.
// We previously revoked the blob URL on unmount which caused the preview
// to sometimes attempt to fetch an already-revoked blob (ERR_FILE_NOT_FOUND).
// The blob is revoked when replaced or when the page unloads; explicit
// revocation can be added later if desired.
</script>

<template>
  <section class="panel">
    <header class="panel__header">
      <div>
        <p class="eyebrow">Step 2b</p>
        <h2 class="panel__title">Bind data source</h2>
      </div>
    </header>

    <div class="form-grid">
      <label class="form-field">
        <span>Provider</span>
        <select
          v-model="local.provider"
          @change="local.kind = providerOptions.find(p => p.value === local.provider)?.kind ?? local.kind"
        >
          <option v-for="opt in providerOptions" :key="opt.value" :value="opt.value">
            {{ opt.label }}
          </option>
        </select>
      </label>

      <label class="form-field">
        <span>Kind</span>
        <input type="text" v-model="local.kind" readonly />
      </label>

      <label class="form-field form-field--wide">
        <span>Source URL / table</span>
        <input type="text" v-model="local.query.source" placeholder="/api/data.json or table name" />
      </label>

      <label class="form-field">
        <span>Upload JSON / CSV / Excel</span>
        <input type="file" accept="application/json,.csv,.tsv,.xls,.xlsx" @change="handleFileUpload" />
      </label>

      <label class="form-field form-field--wide">
        <span>Params (optional JSON string)</span>
        <input
          type="text"
          :value="local.query.params ? JSON.stringify(local.query.params) : ''"
          placeholder='{ "year": 2024 }'
          @input="(e) => {
            const value = (e.target as HTMLInputElement).value;
            try {
              local.query.params = value ? (JSON.parse(value) as Record<string, unknown>) : undefined;
            } catch (_err) {
              // ignore parse errors until valid
            }
          }"
        />
      </label>
    </div>

    <div class="pill-group" style="margin-top: 12px;">
      <button class="pill" type="button" @click="downloadJsonTemplate">Download JSON template</button>
      <button class="pill" type="button" @click="downloadExcelTemplate">Download Excel/CSV template</button>
    </div>

    <!-- Map fields UI disabled per request -->
    <!-- <div v-if="schemaFields.keys.length" class="panel" style="margin-top: 16px;">
      <header class="panel__header">
        <h3 class="panel__title">Map fields</h3>
      </header>
      <div class="form-grid">
        ...
      </div>
    </div> -->
  </section>
</template>
