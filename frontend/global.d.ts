import type { DefaultSession } from "next-auth";

declare module "*.css";

declare module "*.svg" {
	const content: {
		src: string;
		height: number;
		width: number;
		blurDataURL?: string;
	};
	export default content;
}

declare module "next-auth" {
	interface Session {
		user: {
			id: string;
		} & DefaultSession["user"];
	}

	interface User {
		id: string;
	}
}

declare module "next-auth/jwt" {
	interface JWT {
		id?: string;
	}
}
