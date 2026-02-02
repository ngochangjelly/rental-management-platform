import i18next from "i18next";

i18next.init({
  lng: "vi", // default language
  fallbackLng: "en",
  resources: {
    en: {
      translation: {
        sidebar: {
          title: "Rental Hub",
          dashboard: "Dashboard",
          contractAnalysis: "Contract Analysis",
          properties: "Properties",
          tenants: "Tenants",
          createContract: "Create Contract",
          financialReports: "Financial Reports",
          billManagement: "Bill Management",
          bulkPropertyReports: "Bulk Property Reports",
          acCleanManagement: "AC Clean Management",
          investors: "Investors",
          users: "Users",
          loggedInAs: "Logged in as:",
          logout: "Logout",
        },
        dashboard: {
          title: "Dashboard",
          currentDate: "Current Date:",
        },
      },
    },
    vi: {
      translation: {
        sidebar: {
          title: "Rental Hub",
          dashboard: "Trang chủ",
          contractAnalysis: "Phân tích hợp đồng",
          properties: "Quản lí nhà",
          tenants: "Người thuê",
          createContract: "Tạo hợp đồng",
          financialReports: "Báo cáo tài chính",
          billManagement: "Quản lý hóa đơn",
          bulkPropertyReports: "Báo cáo bất động sản hàng loạt",
          acCleanManagement: "Vệ sinh máy lạnh",
          investors: "Nhà đầu tư",
          users: "Người dùng",
          loggedInAs: "Người đăng nhập:",
          logout: "Đăng xuất",
        },
        dashboard: {
          title: "Trang chủ",
          currentDate: "Ngày hiện tại:",
        },
      },
    },
  },
});

export default i18next;
