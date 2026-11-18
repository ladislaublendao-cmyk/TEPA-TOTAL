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

if ( 'quiz' === $tepa_view ) {
	get_template_part( 'template-quiz' );
	return;
}
if ( 'live' === $tepa_view ) {
	get_template_part( 'template-live' );
	return;
}

get_template_part( 'template-vote' );
