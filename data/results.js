/* HD-10 election results — official CT Secretary of the State, Statements of Vote.
   Sources (certified):
     2024: https://portal.ct.gov/-/media/sots/electionservices/statementofvote_pdfs/2024_statement_of_vote.pdf
     2020: https://portal.ct.gov/-/media/sots/electionservices/statementofvote_pdfs/2020-sov.pdf

   Notes:
   - The 10th Assembly District is entirely within East Hartford.
   - State Representative rows are HD-10 district returns. The 2022 race was
     uncontested (incumbent Henry Genga, D, unopposed), so only the contested
     2024 House race is shown.
   - Presidential rows are FULL-TOWN East Hartford totals — CT does not split
     president by House district — comparable year-to-year, not district-exact.
*/
window.RESULTS = {
  note: "Official CT Secretary of the State returns. HD-10 lies entirely within East Hartford; the 2022 House race was uncontested, so only the 2024 race is shown. Presidential rows are full-town totals.",
  towns: ["East Hartford"],
  order: ["pres_2020", "pres_2024", "house_2024"],
  compare: { pres_2024: "pres_2020" },
  races: {
    house_2024: {
      label: "State House · 2024", office: "State Representative · District 10", year: 2024, kind: "House",
      dem: { name: "Henry Genga" }, rep: { name: "Chris Tierrini" }, scope: "HD-10 returns",
      towns: { "East Hartford": { d: 5470, r: 2484 } }
    },
    pres_2024: {
      label: "President · 2024", office: "President", year: 2024, kind: "President",
      dem: { name: "Kamala Harris" }, rep: { name: "Donald Trump" }, scope: "Full-town totals",
      towns: { "East Hartford": { d: 12504, r: 5550 } }
    },
    pres_2020: {
      label: "President · 2020", office: "President", year: 2020, kind: "President",
      dem: { name: "Joe Biden" }, rep: { name: "Donald Trump" }, scope: "Full-town totals",
      towns: { "East Hartford": { d: 14787, r: 5524 } }
    }
  }
};
