export const defaultDiscountCardRules = {
  depositRequired: false,
  depositAmount: 0,
  noShowFee: 18,
  freezeOnUnpaidNoShow: true,
  cancelReleasesUse: true,
};

const amount = value => Math.max(0, Math.min(1000, Number(value)));

export function parseDiscountCardRules(text, current = {}) {
  const source = String(text || '').trim();
  const rules = { ...defaultDiscountCardRules, ...current };
  const changes = {};
  const summary = [];

  if (/不收(?:取)?定金|免定金/.test(source)) {
    changes.depositRequired = false;
    changes.depositAmount = 0;
    summary.push('优惠卡预约不收定金');
  } else {
    const match = source.match(/(?:收(?:取)?\s*)?(\d+(?:\.\d+)?)\s*元?定金|定金\s*(?:改为|设为|收取)?\s*(\d+(?:\.\d+)?)/);
    const value = match?.[1] ?? match?.[2];
    if (value !== undefined) {
      changes.depositRequired = true;
      changes.depositAmount = amount(value);
      summary.push(`优惠卡预约收取 ¥${amount(value)} 定金`);
    }
  }

  const feeMatch = source.match(/爽约费\s*(?:改为|设为|为|是|收取)?\s*(\d+(?:\.\d+)?)\s*元?/) || source.match(/(?:爽约[^。；，,\n]*)?收(?:取)?\s*(\d+(?:\.\d+)?)\s*元爽约费/);
  if (feeMatch) {
    changes.noShowFee = amount(feeMatch[1]);
    summary.push(`爽约不扣次数，登记 ¥${changes.noShowFee} 爽约费`);
  }

  if (/欠费[^。；，,\n]*(?:不暂停|不冻结|仍可|继续使用)/.test(source)) {
    changes.freezeOnUnpaidNoShow = false;
    summary.push('爽约费未结清时仍可使用优惠卡');
  } else if (/(?:欠费|爽约费未结清)[^。；，,\n]*(?:暂停|冻结|不能|不可)/.test(source)) {
    changes.freezeOnUnpaidNoShow = true;
    summary.push('爽约费未结清时暂停使用优惠卡');
  }

  return {
    rules: { ...rules, ...changes },
    changes,
    summary,
    understood: summary.length > 0,
  };
}
