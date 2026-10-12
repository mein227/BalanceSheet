export const EXAMPLES = {
  steady: {
    label: '穩健上班族',
    data: {
      profile: {
        monthlyIncome: 90000,
        monthlyExpense: 35000,
        incomeStability: 'stable',
        yearsToRetire: 25,
        targetNetWorth: 30000000,
        longTermCash: 1200000,
        wouldPanicSell: false,
        hasAddRules: false,
      },
      assets: {
        cash: 600000,
        deposits: 1000000,
        stocks: 2500000,
        bonds: 300000,
        otherInvest: 0,
        insuranceCash: 400000,
        realEstate: 12000000,
        otherAssets: 500000,
      },
      liabilities: [
        { type: 'mortgage', name: '自住房貸', balance: 6000000, rate: 2.2, monthlyPayment: 25000, collateralValue: 0 },
      ],
    },
  },
  leveraged: {
    label: '高槓桿積極派',
    data: {
      profile: {
        monthlyIncome: 120000,
        monthlyExpense: 60000,
        incomeStability: 'unstable',
        yearsToRetire: 20,
        targetNetWorth: 50000000,
        longTermCash: 0,
        wouldPanicSell: true,
        hasAddRules: false,
      },
      assets: {
        cash: 300000,
        deposits: 0,
        stocks: 8000000,
        bonds: 0,
        otherInvest: 500000,
        insuranceCash: 0,
        realEstate: 0,
        otherAssets: 300000,
      },
      liabilities: [
        { type: 'pledge', name: '0050 質押', balance: 4000000, rate: 2.8, monthlyPayment: 9500, collateralValue: 7000000 },
        { type: 'personal', name: '信貸', balance: 1500000, rate: 3.5, monthlyPayment: 27000, collateralValue: 0 },
      ],
    },
  },
  starter: {
    label: '剛起步小資族',
    data: {
      profile: {
        monthlyIncome: 45000,
        monthlyExpense: 30000,
        incomeStability: 'normal',
        yearsToRetire: 35,
        targetNetWorth: 20000000,
        longTermCash: 0,
        wouldPanicSell: false,
        hasAddRules: false,
      },
      assets: {
        cash: 80000,
        deposits: 0,
        stocks: 150000,
        bonds: 0,
        otherInvest: 0,
        insuranceCash: 0,
        realEstate: 0,
        otherAssets: 0,
      },
      liabilities: [
        { type: 'card', name: '信用卡分期', balance: 40000, rate: 15, monthlyPayment: 5000, collateralValue: 0 },
        { type: 'other', name: '學貸', balance: 200000, rate: 1.5, monthlyPayment: 3500, collateralValue: 0 },
      ],
    },
  },
};

export const EMPTY_DATA = {
  profile: {
    monthlyIncome: 0,
    monthlyExpense: 0,
    incomeStability: 'normal',
    yearsToRetire: 25,
    targetNetWorth: 0,
    longTermCash: 0,
    wouldPanicSell: false,
    hasAddRules: false,
  },
  assets: {},
  liabilities: [],
};
