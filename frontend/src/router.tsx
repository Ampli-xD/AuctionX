import { createBrowserRouter } from "react-router-dom";

import HomePage from "@/pages/Home"
import LoginPage from "@/pages/Login"
import DashboardPage from "@/pages/Dashboard"
import BiddingRoom from "@/pages/Bidding"
import SignupSuccess from "@/pages/SignupSuccess"

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
	{
		path: '/bid',
		element: <BiddingRoom />
	},
	{
		path: '/signupsuccess',
		element: <SignupSuccess />
	},


]);


export default router;