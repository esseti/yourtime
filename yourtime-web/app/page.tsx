"use client";

import React, { useState, useEffect } from "react";
import { uploadCsvFile, getDatesAndScores } from "@/app/actions";
import { getScoreColor, getScoreLabel } from "@/lib/scoreCalculator";
import {
  format,
  addMonths,
  subMonths,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isToday,
  isSameDay,
} from "date-fns";
import { it } from "date-fns/locale";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Settings } from "lucide-react";

export default function Home() {
  const [availableDates, setAvailableDates] = useState<string[]>([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [isUploading, setIsUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState<string | null>(null);
  const [dayScores, setDayScores] = useState<Record<string, number>>({});

  const fetchDates = async () => {
    try {
      const { dates, scores } = await getDatesAndScores();
      setAvailableDates(dates);
      setDayScores(scores);
    } catch (err) {
      console.error("Failed to fetch dates", err);
    }
  };

  useEffect(() => {
    fetchDates();
  }, []);

  // const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
  //   const file = e.target.files?.[0];
  //   if (!file) return;

  //   setIsUploading(true);
  //   setUploadMessage(null);
  //   const formData = new FormData();
  //   formData.append('file', file);

  //   try {
  //     await uploadCsvFile(formData);
  //     setUploadMessage(`File caricato con successo.`);
  //     await fetchDates();
  //   } catch (err) {
  //     console.error(err);
  //     setUploadMessage('Errore durante il caricamento del file.');
  //   } finally {
  //     setIsUploading(false);
  //     if (e.target) {
  //       e.target.value = ''; // reset input
  //     }
  //   }
  // };

  const nextMonth = () => setCurrentDate(addMonths(currentDate, 1));
  const prevMonth = () => setCurrentDate(subMonths(currentDate, 1));

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart, { weekStartsOn: 1 });
  const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 });

  const calendarDays = eachDayOfInterval({ start: startDate, end: endDate });

  const weekDays = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"];

  return (
    <div className="min-h-screen bg-gray-50 p-8 font-[family-name:var(--font-geist-sans)] text-gray-900">
      <main className="max-w-5xl mx-auto flex flex-col gap-8">
        <header className="flex flex-col md:flex-row md:justify-between md:items-end gap-4 border-b border-gray-200 pb-6">
          <div className="flex flex-col gap-2">
            <h1 className="text-3xl font-bold tracking-tight text-gray-900">
              Il Tuo Calendario Attività
            </h1>
            <p className="text-gray-500">
              Seleziona un giorno evidenziato dal calendario per analizzare la
              tua timeline.
            </p>
          </div>

          <div className="flex flex-col items-end gap-2">
            <div className="flex gap-2">
              <Link
                href="/settings"
                className="bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 px-4 py-2 rounded-md text-sm font-medium transition-colors"
              >
                <Settings size={20} />
              </Link>
            </div>
            {uploadMessage && (
              <span className="text-xs text-green-600 font-medium">
                {uploadMessage}
              </span>
            )}
          </div>
        </header>

        <section className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <div className="flex justify-between items-center mb-6">
            <button
              onClick={prevMonth}
              className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-100 transition-colors font-medium text-gray-700"
            >
              <ArrowLeft size={20} />
            </button>
            <h2 className="text-2xl font-bold capitalize text-gray-800">
              {format(currentDate, "MMMM yyyy", { locale: it })}
            </h2>
            <button
              onClick={nextMonth}
              className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-100 transition-colors font-medium text-gray-700"
            >
              <ArrowRight size={20} />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-2 mb-2">
            {weekDays.map((day) => (
              <div
                key={day}
                className="text-center font-bold text-gray-500 text-sm py-2 uppercase tracking-wider"
              >
                {day}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-2">
            {calendarDays.map((day, idx) => {
              const formattedDateString = format(day, "yyyy-MM-dd");
              const hasData = availableDates.includes(formattedDateString);
              const isCurrentMonth = isSameMonth(day, monthStart);
              const isTodayDay = isSameDay(day, new Date());
              const dayScore = dayScores[formattedDateString];
              const scoreColor =
                dayScore !== undefined ? getScoreColor(dayScore) : undefined;

              const dayContent = (
                <>
                  <span
                    className={`text-sm font-semibold w-8 h-8 flex items-center justify-center rounded-full mb-2 ${
                      isTodayDay ? "bg-blue-600 text-white" : "text-gray-700"
                    }`}
                  >
                    {format(day, "d")}
                  </span>

                  {dayScore !== undefined && (
                    <div className="mb-2 flex items-center justify-center gap-1">
                      <div
                        className="text-lg font-bold px-2 py-1 rounded"
                        style={{
                          color: scoreColor,
                          backgroundColor: `${scoreColor}20`,
                        }}
                      >
                        {dayScore.toFixed(1)}
                      </div>
                    </div>
                  )}
                </>
              );

              return hasData ? (
                <Link
                  key={idx}
                  href={`/day/${formattedDateString}`}
                  className={`min-h-[120px] relative border rounded-xl p-3 flex flex-col transition-all duration-200 cursor-pointer ${
                    !isCurrentMonth
                      ? "bg-gray-50/50 text-gray-400 border-gray-200"
                      : "bg-white border-gray-400"
                  } ${isTodayDay ? "ring-2 ring-blue-500 border-transparent" : ""} hover:border-blue-400 hover:shadow-lg bg-blue-50/10`}
                >
                  {dayContent}
                </Link>
              ) : (
                <div
                  key={idx}
                  className={`min-h-[120px] relative border rounded-xl p-3 flex flex-col transition-all duration-200 ${
                    !isCurrentMonth
                      ? "bg-gray-50/50 text-gray-400 border-gray-100"
                      : "bg-white border-gray-200"
                  } ${isTodayDay ? "ring-2 ring-blue-500 border-transparent" : ""}`}
                >
                  <div className="mt-auto w-full text-center text-gray-300 text-xs py-2">
                    Nessun dato
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </main>
    </div>
  );
}
