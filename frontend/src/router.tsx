import { createBrowserRouter } from "react-router-dom";

import HomePage from "@/pages/Home"
import LoginPage from "@/pages/Login"
import DashboardPage from "@/pages/Dashboard"


const router = createBrowserRouter([


	{
		path: '/',
		element: <HomePage />,
	},
	{
		path: '/login',
		element: <LoginPage />
	},
	{
		path: '/dashboard',
		element: <DashboardPage />
	},

]);


export default router;