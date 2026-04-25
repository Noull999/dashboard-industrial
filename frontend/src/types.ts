export interface SensorMeta {
  id: string;
  name: string;
  unit: string;
  min_val: number;
  max_val: number;
  location: string;
  sensor_type: string;
  is_production_line: boolean;
}

export interface SensorReading {
  sensor_id: string;
  value: number;
  timestamp: string;
  alert: boolean;
}

export interface HistoryPoint {
  value: number;
  timestamp: string;
}

export interface ActiveAlert {
  id: number;
  sensor_id: string;
  value: number;
  message: string;
  triggered_at: string;
}

export type SensorStatus = "normal" | "alert" | "warning" | "offline";

export function getSensorStatus(value: number, min_val: number, max_val: number): SensorStatus {
  if (value < min_val || value > max_val) return "alert";
  const range = max_val - min_val;
  if (value < min_val + range * 0.1 || value > max_val - range * 0.1) return "warning";
  return "normal";
}
