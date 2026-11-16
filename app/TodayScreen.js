import React, { useCallback, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import DayLogger from "./DayLogger";
import { todayKey } from "../app/storage";

export default function TodayScreen() {
  const [dateKey, setDateKey] = useState(todayKey());

  // Re-evaluate on focus so an app left open overnight lands on the new day.
  useFocusEffect(
    useCallback(() => {
      setDateKey(todayKey());
    }, []),
  );

  return <DayLogger key={dateKey} dateKey={dateKey} />;
}
