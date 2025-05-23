import type {DataPoint} from "../types/dataPoint";

// LTTB(Largest Triangle Three Buckets) down sampling algorithm
export const lttb = (data: DataPoint[], targetPoints: number): DataPoint[] => {
  if (data.length <= targetPoints)
    return [...data];

  const sampled: DataPoint[] = [];

  // Remain the first point
  sampled.push(data[0]);

  const bucketSize = (data.length - 2) / (targetPoints - 2);
  let a = 0;

  for (let i = 0; i < targetPoints - 2; i++) {
    const nextBucketStart = Math.floor((i + 1) * bucketSize) + 1;
    const nextBucketEnd = Math.min(Math.floor((i + 2) * bucketSize) + 1, data.length);

    // Next Bucket's average point
    let avgX = 0, avgY = 0;
    for (let j = nextBucketStart; j < nextBucketEnd; j++) {
      avgX += data[j].timestamp;
      avgY += data[j].value;
    }

    avgX /= (nextBucketEnd - nextBucketStart);
    avgY /= (nextBucketEnd - nextBucketStart);

    // Find the largest triangle point from current bucket
    let maxArea = -1, maxAreaIndex = 0;

    const bucketStart = Math.floor(i * bucketSize) + 1;
    for (let j = bucketStart; j < nextBucketStart; j++) {
      // Calc triangle area
      const area = Math.abs((data[a].timestamp - avgX) * (data[j].value - data[a].value) - (data[a].timestamp - data[j].timestamp) * (avgY - data[a].value)) * 0.5;
      if (area > maxArea) {
        maxArea = area;
        maxAreaIndex = j;
      }
    }

    sampled.push(data[maxAreaIndex]);
    a = maxAreaIndex;
  }

  // Remain the last point
  sampled.push(data[data.length - 1]);

  return sampled;
};

// LTTB algorithm with preserving min & max points
export const lttbWithExtrema = (data: DataPoint[], targetPoints: number): DataPoint[] => {
  if (data.length <= targetPoints)
    return [...data];

  // Find min & max points
  const findExtrema = (points: DataPoint[]): [DataPoint, DataPoint] => {
    let minPoint = points[0], maxPoint = points[0];

    for (const point of points) {
      if (point.value < minPoint.value)
        minPoint = point;
      if (point.value > maxPoint.value)
        maxPoint = point;
    }

    return [minPoint, maxPoint];
  }

  const containsPoint = (points: DataPoint[], targetPoint: DataPoint): boolean => {
    return points.some(p => p.timestamp === targetPoint.timestamp && p.value === targetPoint.value);
  }

  const [minPoint, maxPoint] = findExtrema(data);

  // Adjust target points without min & max points
  const adjustedTargetPoints = targetPoints - (minPoint !== maxPoint ? 2 : 1);

  const sampled = lttb(data, Math.max(2, adjustedTargetPoints));
  if (!containsPoint(sampled, minPoint))
    sampled.push(minPoint);
  if (minPoint !== maxPoint && !containsPoint(sampled, maxPoint))
    sampled.push(maxPoint);

  return sampled.sort((a, b) => a.timestamp - b.timestamp);
};
