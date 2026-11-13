import { memo } from 'react';
import { MinimapRoomCell, RoomDef } from '../game/types';

interface MinimapProps {
  cells: MinimapRoomCell[];
  variant: 'compact' | 'detailed';
}

const DIR_DELTA: Record<'left' | 'right' | 'up' | 'down', { dx: number; dy: number }> = {
  left: { dx: -1, dy: 0 },
  right: { dx: 1, dy: 0 },
  up: { dx: 0, dy: -1 },
  down: { dx: 0, dy: 1 },
};

function resolveRoomPalette(cell: MinimapRoomCell): { fill: string; stroke: string } {
  if (cell.current) {
    if (cell.roomLocked) {
      return { fill: '#471932', stroke: '#ff6b93' };
    }
    return { fill: '#2c5496', stroke: '#98f5ff' };
  }
  if (!cell.visited) {
    return { fill: '#0c1326', stroke: '#3a4c7a' };
  }
  if (cell.isBoss) {
    return cell.bossCleared
      ? { fill: '#193632', stroke: '#6ef2c5' }
      : { fill: '#471932', stroke: '#f0628c' };
  }
  const theme: RoomDef['theme'] = cell.theme ?? 'moonlit';
  switch (theme) {
    case 'tower':
      return { fill: '#1a2c54', stroke: '#7898dc' };
    case 'archive':
      return { fill: '#261d4a', stroke: '#9f82e8' };
    case 'crypt':
      return { fill: '#142d38', stroke: '#5cb8c4' };
    case 'throne':
      return { fill: '#38192c', stroke: '#d66b8e' };
    default:
      return { fill: '#18264a', stroke: '#6d89c9' };
  }
}

interface ScaledBox {
  rx: number;
  ry: number;
  rw: number;
  rh: number;
  cx: number;
  cy: number;
}

function getScaledRoomBox(
  cell: MinimapRoomCell,
  padX: number,
  padY: number,
  cellW: number,
  cellH: number,
  gapX: number,
  gapY: number,
  minScaleX: number,
  minScaleY: number
): ScaledBox {
  const slotX = padX + cell.gridX * (cellW + gapX);
  const slotY = padY + cell.gridY * (cellH + gapY);
  const colsNorm = Math.max(0, Math.min(1, ((cell.widthCols ?? 46) - 34) / 34));
  const rowsNorm = Math.max(0, Math.min(1, ((cell.heightRows ?? 20) - 18) / 16));
  const rw = Math.max(8, Math.round(cellW * (minScaleX + colsNorm * (1 - minScaleX))));
  const rh = Math.max(6, Math.round(cellH * (minScaleY + rowsNorm * (1 - minScaleY))));
  const rx = slotX + Math.floor((cellW - rw) * 0.5);
  const ry = slotY + Math.floor((cellH - rh) * 0.5);
  return {
    rx,
    ry,
    rw,
    rh,
    cx: Math.round(rx + rw * 0.5),
    cy: Math.round(ry + rh * 0.5),
  };
}

export const Minimap = memo(function Minimap({ cells, variant }: MinimapProps) {
  const byCoord = new Map<string, MinimapRoomCell>();
  let maxGridX = 3;
  let maxGridY = 2;
  for (const c of cells) {
    byCoord.set(`${c.gridX},${c.gridY}`, c);
    if (c.gridX > maxGridX) maxGridX = c.gridX;
    if (c.gridY > maxGridY) maxGridY = c.gridY;
  }
  const cols = maxGridX + 1;
  const rows = maxGridY + 1;

  const isNeighborOfVisited = (cell: MinimapRoomCell): boolean => {
    if (cell.visited) return false;
    for (const other of cells) {
      if (!other.visited) continue;
      for (const dir of other.connections) {
        const d = DIR_DELTA[dir];
        if (other.gridX + d.dx === cell.gridX && other.gridY + d.dy === cell.gridY) {
          return true;
        }
      }
    }
    return false;
  };

  if (variant === 'compact') {
    const cellW = cols >= 7 ? 17 : 19;
    const cellH = rows >= 5 ? 12 : 14;
    const gapX = 4;
    const gapY = 4;
    const padX = 6;
    const padY = 6;
    const svgW = padX * 2 + cols * cellW + (cols - 1) * gapX;
    const svgH = padY * 2 + rows * cellH + (rows - 1) * gapY;

    const boxOf = (c: MinimapRoomCell) =>
      getScaledRoomBox(c, padX, padY, cellW, cellH, gapX, gapY, 0.62, 0.62);

    return (
      <div
        aria-label="多尺度洞窟连通域探索小地图"
        className="bg-[#090d1b]/92 border border-[#7c8ec4]/60 shadow-[0_4px_14px_rgba(0,0,0,0.85)] p-1"
      >
        <svg
          width={svgW}
          height={svgH}
          viewBox={`0 0 ${svgW} ${svgH}`}
          shapeRendering="crispEdges"
          className="block"
          aria-hidden="true"
        >
          <line x1="0" y1={svgH / 2} x2={svgW} y2={svgH / 2} stroke="#141d38" strokeWidth="1" />
          <line x1={svgW / 2} y1="0" x2={svgW / 2} y2={svgH} stroke="#141d38" strokeWidth="1" />

          {/* Corridor Tubes spanning exact scaled room boundaries */}
          {cells.map((cell) => {
            if (!cell.visited) return null;
            const b0 = boxOf(cell);
            return cell.connections.map((dir) => {
              const target = byCoord.get(
                `${cell.gridX + DIR_DELTA[dir].dx},${cell.gridY + DIR_DELTA[dir].dy}`
              );
              if (!target) return null;
              const b1 = boxOf(target);
              const isLockedDoor = (cell.current && cell.roomLocked) || (target.current && target.roomLocked);
              const stroke = isLockedDoor ? '#ff5c8a' : target.visited ? '#90b4f8' : '#4a6096';
              if (dir === 'right') {
                return (
                  <rect
                    key={`${cell.id}-r`}
                    x={b0.rx + b0.rw}
                    y={Math.round((b0.cy + b1.cy) * 0.5 - 1.5)}
                    width={Math.max(2, b1.rx - (b0.rx + b0.rw))}
                    height="3"
                    fill={stroke}
                  />
                );
              }
              if (dir === 'down') {
                return (
                  <rect
                    key={`${cell.id}-d`}
                    x={Math.round((b0.cx + b1.cx) * 0.5 - 1.5)}
                    y={b0.ry + b0.rh}
                    width="3"
                    height={Math.max(2, b1.ry - (b0.ry + b0.rh))}
                    fill={stroke}
                  />
                );
              }
              if (dir === 'left' && !target.visited) {
                return (
                  <rect
                    key={`${cell.id}-l`}
                    x={b1.rx + b1.rw}
                    y={Math.round((b0.cy + b1.cy) * 0.5 - 1.5)}
                    width={Math.max(2, b0.rx - (b1.rx + b1.rw))}
                    height="3"
                    fill={stroke}
                  />
                );
              }
              if (dir === 'up' && !target.visited) {
                return (
                  <rect
                    key={`${cell.id}-u`}
                    x={Math.round((b0.cx + b1.cx) * 0.5 - 1.5)}
                    y={b1.ry + b1.rh}
                    width="3"
                    height={Math.max(2, b0.ry - (b1.ry + b1.rh))}
                    fill={stroke}
                  />
                );
              }
              return null;
            });
          })}

          {/* Multi-Scale Room Cells */}
          {cells.map((cell) => {
            const knownNeighbor = isNeighborOfVisited(cell);
            if (!cell.visited && !knownNeighbor) return null;

            const { rx: x, ry: y, rw, rh, cx, cy } = boxOf(cell);
            const pal = resolveRoomPalette(cell);
            const sealRight = cell.sealSide === 'right';

            return (
              <g key={cell.id}>
                <rect
                  x={x}
                  y={y}
                  width={rw}
                  height={rh}
                  fill={pal.fill}
                  stroke={pal.stroke}
                  strokeWidth={cell.current ? '1.6' : '1'}
                  strokeDasharray={cell.visited ? undefined : '2 2'}
                />

                {cell.visited && cell.hasIntactSeal && (
                  <line
                    x1={sealRight ? x + rw - 2 : x + 2}
                    y1={y + 2}
                    x2={sealRight ? x + rw - 2 : x + 2}
                    y2={y + rh - 2}
                    stroke="#cf82ff"
                    strokeWidth="2"
                  />
                )}

                {cell.visited && cell.hasShrine && !cell.current && (
                  <path
                    d={`M${x + 2} ${cy} H${x + 6} M${x + 4} ${cy - 2} V${cy + 2}`}
                    stroke="#7fe8ff"
                    strokeWidth="1.3"
                  />
                )}

                {cell.visited && (cell.hasUncollectedRelic || cell.hasUncollectedAltar) && (
                  <rect
                    x={x + rw - 4}
                    y={y + 2}
                    width="2.5"
                    height="2.5"
                    fill={cell.hasUncollectedRelic ? '#ffe066' : '#8ef0ff'}
                  />
                )}

                {cell.isBoss && (cell.visited || knownNeighbor) && !cell.current && (
                  <rect
                    x={cx - 2}
                    y={cy - 2}
                    width="4"
                    height="4"
                    fill={cell.bossCleared ? '#6ef2c5' : '#ff5c8a'}
                  />
                )}

                {cell.current && (
                  <rect
                    x={cx - 2}
                    y={cy - 2}
                    width="4"
                    height="4"
                    fill={cell.roomLocked ? '#ff6b93' : '#ffffff'}
                  />
                )}
              </g>
            );
          })}
        </svg>
      </div>
    );
  }

  // Detailed Pause / 18-Room Multi-Scale Connected-Domain Star-Map view
  const cellW = cols >= 7 ? 96 : 106;
  const cellH = rows >= 5 ? 46 : 50;
  const gapX = 14;
  const gapY = 14;
  const padX = 14;
  const padY = 14;
  const svgW = padX * 2 + cols * cellW + (cols - 1) * gapX;
  const svgH = padY * 2 + rows * cellH + (rows - 1) * gapY;

  const detailBoxOf = (c: MinimapRoomCell) =>
    getScaledRoomBox(c, padX, padY, cellW, cellH, gapX, gapY, 0.78, 0.78);

  return (
    <div className="bg-[#080c19] border border-[#3a4d80]/70 p-3">
      <svg
        viewBox={`0 0 ${svgW} ${svgH}`}
        className="w-full h-auto block"
        role="img"
        aria-label="洞窟与古堡 18 区域多尺度连通域星盘地图"
      >
        <rect
          x="4"
          y="4"
          width={svgW - 8}
          height={svgH - 8}
          fill="none"
          stroke="#182342"
          strokeWidth="1"
        />

        {/* Connected-Domain Corridor Pipes */}
        {cells.map((cell) => {
          if (!cell.visited) return null;
          const b0 = detailBoxOf(cell);
          return cell.connections.map((dir) => {
            const target = byCoord.get(
              `${cell.gridX + DIR_DELTA[dir].dx},${cell.gridY + DIR_DELTA[dir].dy}`
            );
            if (!target) return null;
            const b1 = detailBoxOf(target);
            const isLockedDoor =
              (cell.current && cell.roomLocked) || (target.current && target.roomLocked);
            const wallCol = isLockedDoor ? '#ff6b93' : target.visited ? '#86aaf2' : '#43588c';
            const fillCol = isLockedDoor ? '#471932' : target.visited ? '#1d3566' : '#101830';
            if (dir === 'right') {
              return (
                <rect
                  key={`${cell.id}-dr`}
                  x={b0.rx + b0.rw}
                  y={Math.round((b0.cy + b1.cy) * 0.5 - 4)}
                  width={Math.max(4, b1.rx - (b0.rx + b0.rw))}
                  height="8"
                  fill={fillCol}
                  stroke={wallCol}
                  strokeWidth="1.4"
                />
              );
            }
            if (dir === 'down') {
              return (
                <rect
                  key={`${cell.id}-dd`}
                  x={Math.round((b0.cx + b1.cx) * 0.5 - 4)}
                  y={b0.ry + b0.rh}
                  width="8"
                  height={Math.max(4, b1.ry - (b0.ry + b0.rh))}
                  fill={fillCol}
                  stroke={wallCol}
                  strokeWidth="1.4"
                />
              );
            }
            if (dir === 'left' && !target.visited) {
              return (
                <rect
                  key={`${cell.id}-dl`}
                  x={b1.rx + b1.rw}
                  y={Math.round((b0.cy + b1.cy) * 0.5 - 3)}
                  width={Math.max(4, b0.rx - (b1.rx + b1.rw))}
                  height="6"
                  fill={fillCol}
                  stroke={wallCol}
                  strokeWidth="1.2"
                />
              );
            }
            if (dir === 'up' && !target.visited) {
              return (
                <rect
                  key={`${cell.id}-du`}
                  x={Math.round((b0.cx + b1.cx) * 0.5 - 3)}
                  y={b1.ry + b1.rh}
                  width="6"
                  height={Math.max(4, b0.ry - (b1.ry + b1.rh))}
                  fill={fillCol}
                  stroke={wallCol}
                  strokeWidth="1.2"
                />
              );
            }
            return null;
          });
        })}

        {/* Multi-Scale Room Nodes */}
        {cells.map((cell) => {
          const knownNeighbor = isNeighborOfVisited(cell);
          if (!cell.visited && !knownNeighbor) return null;

          const { rx: x, ry: y, rw, rh, cx } = detailBoxOf(cell);
          const pal = resolveRoomPalette(cell);
          const sealRight = cell.sealSide === 'right';

          return (
            <g key={cell.id}>
              <rect
                x={x}
                y={y}
                width={rw}
                height={rh}
                fill={pal.fill}
                stroke={pal.stroke}
                strokeWidth={cell.current ? '2' : '1.25'}
                strokeDasharray={cell.visited ? undefined : '4 3'}
              />

              <text
                x={cx}
                y={y + Math.round(rh * 0.42)}
                textAnchor="middle"
                fill={cell.visited ? '#eef4ff' : '#6c80b0'}
                fontSize="10.5"
                fontWeight="700"
                fontFamily="Noto Sans SC, sans-serif"
              >
                {cell.visited ? cell.nameZh : '未知洞窟 ?'}
              </text>

              <text
                x={cx}
                y={y + Math.round(rh * 0.78)}
                textAnchor="middle"
                fill={
                  cell.current
                    ? cell.roomLocked
                      ? '#ff85a6'
                      : '#8ef0ff'
                    : '#9ab0de'
                }
                fontSize="8.8"
                fontFamily="JetBrains Mono, Noto Sans SC, monospace"
              >
                {cell.current
                  ? cell.roomLocked
                    ? '◆ 封锁激战'
                    : '◆ 当前所在'
                  : cell.visited
                    ? [
                        cell.hasShrine ? '祭坛' : '',
                        cell.hasUncollectedRelic ? '遗物' : '',
                        cell.hasUncollectedAltar ? '卷轴' : '',
                        cell.hasIntactSeal ? '封印' : '',
                        cell.isBoss ? (cell.bossCleared ? '已破' : '首领') : '',
                      ]
                        .filter(Boolean)
                        .join('·') || `${cell.widthCols ?? 46}×${cell.heightRows ?? 20}`
                    : cell.isBoss
                      ? '首领圣殿'
                      : '相邻通路'}
              </text>

              {cell.visited && cell.hasIntactSeal && (
                <line
                  x1={sealRight ? x + rw - 3 : x + 3}
                  y1={y + 4}
                  x2={sealRight ? x + rw - 3 : x + 3}
                  y2={y + rh - 4}
                  stroke="#cf82ff"
                  strokeWidth="3"
                />
              )}
            </g>
          );
        })}
      </svg>

      <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 text-[11px] text-[#96aad8] border-t border-[#1e2a4d] pt-2">
        <span>◆ 多尺度连通域洞窟：小窟 / 长廊 / 高耸竖井 / 圣殿（未肃清敌影时落下封锁铁门）</span>
        <span>紫竖线：裂空封印门 · 绯红框：封锁或首领圣殿</span>
      </div>
    </div>
  );
});
