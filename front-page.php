<?php
/**
 * Front Page & Query-String Router
 * Default home (/) renders the iPhone 17 - 1 Voting System screen directly.
 * Supports ?view=quiz, ?view=vote, and ?view=live.
 */
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

$tepa_view = isset( $_GET['view'] ) ? sanitize_key( wp_unslash( $_GET['view'] ) ) : '';

if ( 'admin' === $tepa_view || 'backoffice' === $tepa_view ) {
	$target_admin_url = admin_url( 'admin.php?page=tepa-award-2026' );
	if ( is_user_logged_in() && current_user_can( 'manage_options' ) ) {
		wp_safe_redirect( $target_admin_url );
	} else {
		wp_safe_redirect( wp_login_url( $target_admin_url ) );
	}
	exit;
}

if ( 'quiz' === $tepa_view ) {
	get_template_part( 'template-quiz' );
	return;
}
if ( 'live' === $tepa_view ) {
	get_template_part( 'template-live' );
	return;
}

get_template_part( 'template-vote' );
