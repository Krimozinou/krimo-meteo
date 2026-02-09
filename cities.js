// Krimo Météo Algérie — liste des villes (24)
// 6 littoral • 6 proche littoral • 6 hauts plateaux • 6 Sud

window.CITIES = [
  {
    group: "Littoral",
    items: [
      { name: "Alger", lat: 36.7538, lon: 3.0588 },
      { name: "Oran", lat: 35.6971, lon: -0.6308 },
      { name: "Annaba", lat: 36.9, lon: 7.7667 },
      { name: "Skikda", lat: 36.879, lon: 6.906 },
      { name: "Mostaganem", lat: 35.931, lon: 0.089 },
      { name: "Chlef", lat: 36.165, lon: 1.334 }
    ]
  },
  {
    group: "Proche littoral",
    items: [
      { name: "Blida", lat: 36.47, lon: 2.83 },
      { name: "Boumerdès", lat: 36.766, lon: 3.477 },
      { name: "Tipaza", lat: 36.59, lon: 2.45 },
      { name: "Tizi Ouzou", lat: 36.7167, lon: 4.05 },
      { name: "Bouira", lat: 36.373, lon: 3.9 },
      { name: "Médéa", lat: 36.264, lon: 2.763 }
    ]
  },
  {
    group: "Hauts Plateaux",
    items: [
      { name: "Sétif", lat: 36.19, lon: 5.41 },
      { name: "Bordj Bou Arréridj", lat: 36.07, lon: 4.76 },
      { name: "M'Sila", lat: 35.705, lon: 4.541 },
      { name: "Tiaret", lat: 35.37, lon: 1.32 },
      { name: "Saïda", lat: 34.83, lon: 0.15 },
      { name: "Tébessa", lat: 35.41, lon: 8.12 }
    ]
  },
  {
    group: "Sud",
    items: [
      { name: "Ghardaïa", lat: 32.49, lon: 3.67 },
      { name: "Ouargla", lat: 31.95, lon: 5.33 },
      { name: "Biskra", lat: 34.85, lon: 5.73 },
      { name: "Laghouat", lat: 33.8, lon: 2.87 },
      { name: "Adrar", lat: 27.87, lon: -0.29 },
      { name: "Tamanrasset", lat: 22.79, lon: 5.52 }
    ]
  }
];

// Ville sélectionnée par défaut
window.DEFAULT_CITY = { name: "Alger", lat: 36.7538, lon: 3.0588 };
