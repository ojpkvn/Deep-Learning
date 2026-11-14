/* Nutrition estimates for the four dishes the model knows.
 * These are ESTIMATES for one typical serving, not measurements. The app lets the user pick a portion
 * size and edit the numbers before saving. Edit this table if you find better figures for the dishes you eat.
 *
 * Sources (checked Nov 2026):
 *  - Laksa: Singapore Health Promotion Board (HPB) food composition database, full bowl 604 g = 429 kcal,
 *    511 mg sodium per 100 g (= ~3,086 mg per bowl), via NutriKaki.
 *  - Mee goreng: sodium from HPB database (465 g plate = 3,050 mg, via NutriKaki). Calories are scaled up from a
 *    309 g listing of 500 kcal / 1,851 mg sodium (HealthXchange), so treat the calories as an estimate.
 *  - Pho (beef): one nutrition-app listing for a large 600 ml bowl, 450 kcal / 1,500 mg. Restaurant pho is often saltier.
 *  - Ramen: restaurant-bowl calorie estimates are ~700-900 kcal (shoyu ~700, miso ~800, tonkotsu ~900).
 *    No reliable sodium source was found; 2,300 mg is a rough middle value and varies a lot with the broth.
 */
(function (root) {
  const DISHES = {
    laksa: {
      label: 'Laksa', serving: '1 bowl (~600 g)', kcal: 429, sodium: 3086,
      note: 'Calories and sodium from the Singapore HPB database (curry laksa, full bowl).'
    },
    mee_goreng: {
      label: 'Mee goreng', serving: '1 plate (~465 g)', kcal: 750, sodium: 3050,
      note: 'Sodium from the HPB database. Calories are an estimate scaled from a smaller listing; oil and egg change it a lot.'
    },
    pho: {
      label: 'Pho', serving: '1 large bowl (~600 ml)', kcal: 450, sodium: 1500,
      note: 'From a nutrition-app listing for beef pho. Restaurant bowls are often higher in sodium.'
    },
    ramen: {
      label: 'Ramen', serving: '1 restaurant bowl', kcal: 750, sodium: 2300,
      note: 'Calories are a typical restaurant range (700-900). Sodium is a rough estimate and depends on the broth.'
    }
  };

  const PORTIONS = [
    { id: 'small', label: 'Small', factor: 0.75 },
    { id: 'regular', label: 'Regular', factor: 1 },
    { id: 'large', label: 'Large', factor: 1.25 }
  ];

  // Suggested numbers for a dish + portion, rounded to something that does not pretend to be exact
  function estimate(dishKey, portionId) {
    const d = DISHES[dishKey];
    const p = PORTIONS.find((x) => x.id === portionId) || PORTIONS[1];
    return {
      kcal: Math.round((d.kcal * p.factor) / 5) * 5,
      sodium: Math.round((d.sodium * p.factor) / 10) * 10
    };
  }

  function mealForHour(h) {
    if (h >= 5 && h < 10) return 'Breakfast';
    if (h >= 10 && h < 15) return 'Lunch';
    if (h >= 15 && h < 18) return 'Snack';
    if (h >= 18 && h < 23) return 'Dinner';
    return 'Snack';
  }

  root.Nutrition = { DISHES, PORTIONS, estimate, mealForHour };
})(typeof window !== 'undefined' ? window : globalThis);
