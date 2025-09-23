(function () {
  if (!window.PremiumDealershipDashboard) {
    console.error("PremiumDealershipDashboard is not defined on window.");
    return;
  }
  const root = ReactDOM.createRoot(document.getElementById("root"));
  root.render(React.createElement(window.PremiumDealershipDashboard));
})();