import Papa from "papaparse";
import {
  Category,
  normalizeCategoryName,
  generateRandomColor,
} from "./settings";

export function exportCategoriesCSV(categories: Category[]) {
  const csv = Papa.unparse({
    fields: ["name", "color", "weight", "dailyLimitHours"],
    data: categories,
  });
  downloadCSV(csv, "categorie.csv");
}

export function exportAppMappingsCSV(
  appMappings: Record<string, string>,
  knownApps?: string[],
  meetingRelatedApps?: string[],
  appWeights?: Record<string, number | null>,
) {
  const data: {
    name: string;
    categoryName: string;
    weight: number | null | "";
    meetingRelated: boolean;
  }[] = [];

  if (knownApps) {
    for (const appName of knownApps) {
      data.push({
        name: appName,
        categoryName: appMappings[appName] || "",
        weight: appWeights?.[appName] ?? "",
        meetingRelated: meetingRelatedApps?.includes(appName) || false,
      });
    }
  } else {
    for (const [name, categoryName] of Object.entries(appMappings)) {
      data.push({
        name,
        categoryName,
        weight: appWeights?.[name] ?? "",
        meetingRelated: meetingRelatedApps?.includes(name) || false,
      });
    }
  }

  const csv = Papa.unparse({
    fields: ["name", "categoryName", "weight", "meetingRelated"],
    data: data,
  });
  downloadCSV(csv, "assegnazioni-app.csv");
}

export function exportDomainMappingsCSV(
  domainMappings: Record<string, string>,
  knownDomains?: string[],
  meetingRelatedDomains?: string[],
  domainWeights?: Record<string, number | null>,
) {
  const data: {
    name: string;
    categoryName: string;
    weight: number | null | "";
    meetingRelated: boolean;
  }[] = [];

  if (knownDomains) {
    for (const domain of knownDomains) {
      data.push({
        name: domain,
        categoryName: domainMappings[domain] || "",
        weight: domainWeights?.[domain] ?? "",
        meetingRelated: meetingRelatedDomains?.includes(domain) || false,
      });
    }
  } else {
    for (const [name, categoryName] of Object.entries(domainMappings)) {
      data.push({
        name,
        categoryName,
        weight: domainWeights?.[name] ?? "",
        meetingRelated: meetingRelatedDomains?.includes(name) || false,
      });
    }
  }

  const csv = Papa.unparse({
    fields: ["name", "categoryName", "weight", "meetingRelated"],
    data: data,
  });
  downloadCSV(csv, "assegnazioni-domini.csv");
}

export function exportMappingsCSV(
  appMappings: Record<string, string>,
  domainMappings: Record<string, string>,
) {
  const data: { type: string; name: string; categoryName: string }[] = [];

  for (const [name, categoryName] of Object.entries(appMappings)) {
    data.push({ type: "app", name, categoryName });
  }

  for (const [name, categoryName] of Object.entries(domainMappings)) {
    data.push({ type: "domain", name, categoryName });
  }

  const csv = Papa.unparse({
    fields: ["type", "name", "categoryName"],
    data: data,
  });
  downloadCSV(csv, "assegnazioni.csv");
}

function downloadCSV(csv: string, filename: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function parseCategoriesCSV(file: File): Promise<Category[]> {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const categories = (results.data as any[])
          .map((cat) => {
            const normalizedName = normalizeCategoryName(cat.name || "");
            if (!normalizedName) {
              return null;
            }
            const weight =
              cat.weight !== undefined ? parseFloat(cat.weight) : 0;
            const dailyLimitHours = cat.dailyLimitHours
              ? parseFloat(cat.dailyLimitHours)
              : undefined;
            const category: Category = {
              name: normalizedName,
              color: cat.color || generateRandomColor(),
              weight: isNaN(weight) ? 0 : weight,
              dailyLimitHours:
                dailyLimitHours && !isNaN(dailyLimitHours)
                  ? dailyLimitHours
                  : undefined,
            };
            return category;
          })
          .filter((cat) => cat !== null) as Category[];

        const uniqueCategories: Category[] = [];
        const seen = new Set<string>();
        for (const cat of categories) {
          if (!seen.has(cat.name)) {
            seen.add(cat.name);
            uniqueCategories.push(cat);
          }
        }

        resolve(uniqueCategories);
      },
      error: (error) => reject(error),
    });
  });
}

export function parseMappingsCSV(
  file: File,
  existingCategories: Category[],
): Promise<{
  appMappings: Record<string, string>;
  domainMappings: Record<string, string>;
  appWeights: Record<string, number | null>;
  domainWeights: Record<string, number | null>;
  meetingRelatedApps: string[];
  meetingRelatedDomains: string[];
  missingCategories: string[];
}> {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const rows = results.data as any[];
        const appMappings: Record<string, string> = {};
        const domainMappings: Record<string, string> = {};
        const appWeights: Record<string, number | null> = {};
        const domainWeights: Record<string, number | null> = {};
        const meetingRelatedApps: string[] = [];
        const meetingRelatedDomains: string[] = [];
        const missingCategoriesSet = new Set<string>();

        const categoryNames = new Set(
          existingCategories.map((cat) => cat.name),
        );

        for (const row of rows) {
          const categoryName = row.categoryName || row.categoryId || "";
          if (!categoryName) continue;

          const normalizedCategoryName = normalizeCategoryName(categoryName);

          if (!categoryNames.has(normalizedCategoryName)) {
            missingCategoriesSet.add(categoryName);
            continue;
          }

          const isMeetingRelated =
            row.meetingRelated === true ||
            row.meetingRelated === "true" ||
            row.meetingRelated === "1";

          const weight =
            row.weight !== undefined && row.weight !== "" && row.weight !== null
              ? parseFloat(row.weight)
              : null;
          const validWeight = weight !== null && !isNaN(weight) ? weight : null;

          if (row.type) {
            if (row.type === "app" && row.name) {
              appMappings[row.name] = normalizedCategoryName;
              appWeights[row.name] = validWeight;
              if (isMeetingRelated) {
                meetingRelatedApps.push(row.name);
              }
            } else if (row.type === "domain" && row.name) {
              domainMappings[row.name] = normalizedCategoryName;
              domainWeights[row.name] = validWeight;
              if (isMeetingRelated) {
                meetingRelatedDomains.push(row.name);
              }
            }
          } else if (row.name) {
            appMappings[row.name] = normalizedCategoryName;
            domainMappings[row.name] = normalizedCategoryName;
            appWeights[row.name] = validWeight;
            domainWeights[row.name] = validWeight;
            if (isMeetingRelated) {
              meetingRelatedApps.push(row.name);
              meetingRelatedDomains.push(row.name);
            }
          }
        }

        resolve({
          appMappings,
          domainMappings,
          appWeights,
          domainWeights,
          meetingRelatedApps,
          meetingRelatedDomains,
          missingCategories: Array.from(missingCategoriesSet),
        });
      },
      error: (error) => reject(error),
    });
  });
}
