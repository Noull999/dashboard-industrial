import type { SensorMeta, SensorReading } from '../types';
interface Props { sensor: SensorMeta | null; reading: SensorReading | null; onClose: () => void; }
export default function SensorDrawer({ onClose }: Props) {
  return <div onClick={onClose} />;
}
