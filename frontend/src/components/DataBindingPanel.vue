<script setup lang="ts">
import { reactive, watch, onBeforeUnmount } from "vue";
import type { DataBinding } from "../specs/chartSpec";

const props = defineProps<{
  binding: DataBinding;
}>();

const emit = defineEmits<{
  (e: "update:binding", payload: DataBinding): void;
  (e: "update:encoding", payload: { category: string; value: string; series?: string }): void;
  (e: "update:years", payload: string[]): void;
  (e: "navigate:config"): void;
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

function handleFileUpload(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    const text = String(reader.result ?? "");
    try {
      const parsed = JSON.parse(text);
      uploadedRows = Array.isArray(parsed) ? parsed : (Array.isArray(parsed?.data) ? parsed.data : []);
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
    } catch (_err) {
      alert("Invalid JSON file. Please upload a valid JSON array or object.");
      return;
    }

    if (fileObjectUrl) URL.revokeObjectURL(fileObjectUrl);
    fileObjectUrl = URL.createObjectURL(new Blob([text], { type: "application/json" }));

    local.provider = "json";
    local.kind = "json";
    local.query.source = fileObjectUrl;
    local.query.params = undefined;

    // Emit an initial encoding guess
    if (mapping.category && mapping.value) {
      emit("update:encoding", { category: mapping.category, value: mapping.value, series: mapping.series });
    }
    emit("navigate:config");
  };
  reader.readAsText(file);
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

onBeforeUnmount(() => {
  if (fileObjectUrl) URL.revokeObjectURL(fileObjectUrl);
});
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
        <span>Upload JSON</span>
        <input type="file" accept="application/json" @change="handleFileUpload" />
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

    <div v-if="schemaFields.keys.length" class="panel" style="margin-top: 16px;">
      <header class="panel__header">
        <h3 class="panel__title">Map fields</h3>
      </header>
      <div class="form-grid">
        <label class="form-field">
          <span>X (category)</span>
          <select v-model="mapping.category" @change="() => emit('update:encoding', { category: mapping.category!, value: mapping.value!, series: mapping.series })">
            <option v-for="k in schemaFields.keys" :key="k" :value="k">{{ k }}</option>
          </select>
        </label>
        <label class="form-field">
          <span>Y (value)</span>
          <select v-model="mapping.value" @change="() => emit('update:encoding', { category: mapping.category!, value: mapping.value!, series: mapping.series })">
            <option v-for="k in schemaFields.keys" :key="k" :value="k">{{ k }}</option>
          </select>
        </label>
        <label class="form-field">
          <span>Series / Year (optional)</span>
          <select v-model="mapping.series" @change="() => {
            const years = mapping.series ? Array.from(new Set(uploadedRows.map(r => String(r[mapping.series!]))).values()) : [];
            mapping.years = years;
            emit('update:years', mapping.years);
            emit('update:encoding', { category: mapping.category!, value: mapping.value!, series: mapping.series });
          }">
            <option :value="undefined">None</option>
            <option v-for="k in schemaFields.keys" :key="k" :value="k">{{ k }}</option>
          </select>
        </label>
        <label class="form-field form-field--wide" v-if="mapping.series">
          <span>Filter years</span>
          <select multiple v-model="mapping.years" @change="() => emit('update:years', mapping.years)">
            <option v-for="y in Array.from(new Set(uploadedRows.map(r => String(r[mapping.series!]))).values())" :key="y" :value="y">{{ y }}</option>
          </select>
        </label>
      </div>
    </div>
  </section>
</template>
