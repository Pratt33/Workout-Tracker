import React from "react";
import DayLogger from "./DayLogger";
import { todayKey } from "./storage";

export default function TodayScreen() {
  const dow = new Date().getDay();
  const dateKey = todayKey();
  return <DayLogger dateKey={dateKey} dow={dow} />;
}
