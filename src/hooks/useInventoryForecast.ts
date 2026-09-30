import { useMemo } from 'react';
import { ReagentMaterial, Transaction } from '../types';

export interface ForecastItem {
  reagentId: string;
  reagentName: string;
  lotNumber: string;
  category: string;
  currentStock: number;
  consumedLast30Days: number;
  dailyConsumptionRate: number;
  daysToDepletion: number | null;
  needsRestock: boolean;
}

export function useInventoryForecast(
  reagents: ReagentMaterial[],
  transactions: Transaction[],
  simulatedTimeStr: string,
  daysToAnalyze: number = 30,
  alertThresholdDays: number = 15
) {
  return useMemo(() => {
    const simulatedTime = new Date(simulatedTimeStr).getTime();
    const analyzePeriodMs = daysToAnalyze * 24 * 60 * 60 * 1000;
    const periodStartMs = simulatedTime - analyzePeriodMs;

    // Filter transactions within the analyzed period
    const recentTx = transactions.filter(tx => {
      const txTime = new Date(tx.timestamp).getTime();
      return txTime >= periodStartMs && txTime <= simulatedTime;
    });

    const forecastItems: ForecastItem[] = reagents.map(reagent => {
      // Find all consumption transactions for this reagent
      const reagentTxs = recentTx.filter(tx => tx.reagentId === reagent.id);
      
      const consumedQty = reagentTxs
        .filter(tx => tx.type === 'xuat' || tx.type === 'linh' || tx.type === 'Hủy' || tx.type === 'Xuất')
        .reduce((sum, tx) => sum + tx.quantity, 0);

      // Average daily consumption
      const dailyConsumptionRate = consumedQty / daysToAnalyze;
      
      // Calculate days to depletion
      const daysToDepletion = dailyConsumptionRate > 0 
        ? Math.floor(reagent.currentStock / dailyConsumptionRate) 
        : null;
        
      const needsRestock = daysToDepletion !== null && daysToDepletion <= alertThresholdDays;

      return {
        reagentId: reagent.id,
        reagentName: reagent.name,
        lotNumber: reagent.lotNumber || '',
        category: reagent.category,
        currentStock: reagent.currentStock,
        consumedLast30Days: consumedQty,
        dailyConsumptionRate,
        daysToDepletion,
        needsRestock
      };
    });

    // Sort by most critical first (lowest days to depletion)
    return forecastItems
      .filter(item => item.needsRestock)
      .sort((a, b) => {
        if (a.daysToDepletion === null) return 1;
        if (b.daysToDepletion === null) return -1;
        return a.daysToDepletion - b.daysToDepletion;
      });

  }, [reagents, transactions, simulatedTimeStr, daysToAnalyze, alertThresholdDays]);
}
